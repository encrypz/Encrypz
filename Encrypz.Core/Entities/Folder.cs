using System;
using System.Collections.Generic;

namespace Encrypz.Core.Entities
{
    public class Folder
    {
        public Guid Id { get; set; }
        
        public Guid UserId { get; set; }
        public User User { get; set; }
        
        public Guid? ParentFolderId { get; set; }
        public Folder ParentFolder { get; set; }
        
        public byte[] EncryptedFolderName { get; set; }
        public byte[] InitializationVector { get; set; }
        public byte[] AuthenticationTag { get; set; }

        public ICollection<Folder> SubFolders { get; set; }
        public ICollection<EncryptedFile> Files { get; set; }
    }
}
