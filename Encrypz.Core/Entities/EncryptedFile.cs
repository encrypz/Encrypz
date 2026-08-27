using System;

namespace Encrypz.Core.Entities
{
    public class EncryptedFile
    {
        public Guid Id { get; set; }
        
        public byte[] EncryptedFileName { get; set; } = Array.Empty<byte>();
        public string GoogleDriveFileId { get; set; } = string.Empty;
        public byte[] InitializationVector { get; set; } = Array.Empty<byte>();
        public byte[] AuthenticationTag { get; set; } = Array.Empty<byte>();

        // Foreign Key
        public Guid UserId { get; set; }
        
        // Navigation property
        public User User { get; set; } = null!;
    }
}
