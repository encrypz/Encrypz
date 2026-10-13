#!/usr/bin/env python3
"""Prepare a browser import bundle from MongoDB Extended JSON exports (no database connection).
Usage: python3 scripts/prepare-legacy-import.py --users Users.json --files EncryptedFiles.json --folders Folders.json --user-id UUID --output legacy-vault.json
Export each collection using mongoexport --jsonArray, then run this script locally.
This deliberately excludes password hashes, Google tokens, and session keys.
"""
import argparse
import base64
import json
import uuid
from pathlib import Path


def read(path):
    text = Path(path).read_text()
    return json.loads(text) if text.lstrip().startswith('[') else [json.loads(line) for line in text.splitlines() if line.strip()]


def identifier(value):
    if value is None:
        return None
    if isinstance(value, str):
        return str(uuid.UUID(value))
    if '$uuid' in value:
        return str(uuid.UUID(value['$uuid']))
    binary = value['$binary']
    raw = base64.b64decode(binary['base64'], validate=True)
    # Old .NET Guid serialization used CSharpLegacy byte order (subtype 03).
    return str(uuid.UUID(bytes_le=raw) if binary['subType'] == '03' else uuid.UUID(bytes=raw))


def binary(value):
    if value is None:
        return None
    result = value if isinstance(value, str) else value['$binary']['base64']
    base64.b64decode(result, validate=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['users', 'files', 'folders', 'user-id', 'output']:
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    owner = str(uuid.UUID(args.user_id))
    users = [u for u in read(args.users) if identifier(u['_id']) == owner]
    if len(users) != 1:
        raise ValueError('Exactly one matching user is required.')
    files = []
    for f in read(args.files):
        if identifier(f['UserId']) != owner:
            continue
        files.append(dict(id=identifier(f['_id']), driveFileId=f['GoogleDriveFileId'],
            filename=base64.b64decode(binary(f['EncryptedFileName'])).decode('utf-8'),
            iv=binary(f['InitializationVector']), tag=binary(f['AuthenticationTag']),
            folderId=identifier(f.get('FolderId')), isDeleted=bool(f.get('IsDeleted', False))))
    folders = []
    for f in read(args.folders):
        if identifier(f['UserId']) == owner:
            folders.append(dict(id=identifier(f['_id']), parentId=identifier(f.get('ParentFolderId')),
                name=binary(f['EncryptedFolderName']), iv=binary(f['InitializationVector']),
                tag=binary(f['AuthenticationTag']), isDeleted=bool(f.get('IsDeleted', False))))
    # Exclusive creation prevents replacing a user's existing backup accidentally.
    with open(args.output, 'x') as output:
        json.dump(dict(format='encrypz-legacy-v1', username=users[0]['Username'], files=files, folders=folders), output, indent=2)
    print(f'Prepared {len(files)} files and {len(folders)} folders. Original data was not modified.')


if __name__ == '__main__':
    main()
