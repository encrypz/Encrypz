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

        public long FileSize { get; set; } = 0;
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        // Thumbnail Data (Optional)
        public byte[]? EncryptedThumbnail { get; set; }
        public byte[]? ThumbnailIv { get; set; }
        public byte[]? ThumbnailAuthTag { get; set; }

        // Foreign Key
        public Guid UserId { get; set; }
        
        // Navigation property
        public User User { get; set; } = null!;

        public Guid? FolderId { get; set; }
        public Folder? Folder { get; set; }

        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
    }
}
