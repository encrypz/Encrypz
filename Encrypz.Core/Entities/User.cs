using System;
using System.Collections.Generic;

namespace Encrypz.Core.Entities
{
    public class User
    {
        public Guid Id { get; set; }
        public string Username { get; set; } = string.Empty;
        
        // Navigation property
        public ICollection<EncryptedFile> EncryptedFiles { get; set; } = new List<EncryptedFile>();
    }
}
