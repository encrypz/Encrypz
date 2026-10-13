import base64
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import uuid

SCRIPT = Path(__file__).with_name('prepare-legacy-import.py')
spec = importlib.util.spec_from_file_location('migration', SCRIPT)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class LegacyImportTests(unittest.TestCase):
    def test_guid_formats(self):
        value = uuid.uuid4()
        self.assertEqual(str(value), migration.identifier({'$uuid': str(value)}))
        for subtype, raw in [('03', value.bytes_le), ('04', value.bytes)]:
            self.assertEqual(str(value), migration.identifier({'$binary': {'subType': subtype, 'base64': base64.b64encode(raw).decode()}}))

    def test_export_excludes_secrets_and_other_users_and_preserves_originals(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            owner, other, file_id = map(str, [uuid.uuid4(), uuid.uuid4(), uuid.uuid4()])
            user = {'_id': owner, 'Username': 'OriginalSalt', 'PasswordHash': 'private-hash', 'GoogleRefreshToken': 'private-token'}
            files = [{'_id': file_id, 'UserId': owner, 'GoogleDriveFileId': 'remote-file', 'EncryptedFileName': 'b2xkLnR4dA==',
                      'InitializationVector': base64.b64encode(bytes(12)).decode(), 'AuthenticationTag': base64.b64encode(bytes(16)).decode(), 'IsDeleted': True},
                     {'_id': str(uuid.uuid4()), 'UserId': other}]
            for name, data in [('Users', [user]), ('EncryptedFiles', files), ('Folders', [])]:
                (root / f'{name}.json').write_text(json.dumps(data))
            command = [sys.executable, str(SCRIPT), '--users', str(root / 'Users.json'), '--files', str(root / 'EncryptedFiles.json'),
                       '--folders', str(root / 'Folders.json'), '--user-id', owner, '--output', str(root / 'bundle.json')]
            subprocess.run(command, check=True, capture_output=True)
            output = (root / 'bundle.json').read_text()
            self.assertNotIn('private-', output)
            bundle = json.loads(output)
            self.assertEqual(bundle['username'], 'OriginalSalt')
            self.assertEqual(len(bundle['files']), 1)
            self.assertEqual(bundle['files'][0]['filename'], 'old.txt')
            self.assertTrue(bundle['files'][0]['isDeleted'])
            self.assertEqual(json.loads((root / 'Users.json').read_text()), [user])
            # Existing backup must not be overwritten.
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
            self.assertEqual((root / 'bundle.json').read_text(), output)


if __name__ == '__main__':
    unittest.main()
