using System;

namespace Encrypz.Core.DTOs
{
    public class FileUploadDto
    {
        public string EncryptedFileName { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public DateTime UploadedAt { get; set; }
        public string Payload { get; set; } = string.Empty; // Base64
        public string InitializationVector { get; set; } = string.Empty; // Base64
        public string AuthenticationTag { get; set; } = string.Empty; // Base64
        public Guid UserId { get; set; }
        public Guid? FolderId { get; set; }

        public string? EncryptedThumbnail { get; set; } // Base64
        public string? ThumbnailIv { get; set; } // Base64
        public string? ThumbnailAuthTag { get; set; } // Base64
    }

    public class FileListDto
    {
        public Guid Id { get; set; }
        public string EncryptedFileName { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public DateTime UploadedAt { get; set; }
        public Guid? FolderId { get; set; }

        public string? EncryptedThumbnail { get; set; }
        public string? ThumbnailIv { get; set; }
        public string? ThumbnailAuthTag { get; set; }
    }

    public class FileDownloadDto
    {
        public Guid Id { get; set; }
        public string EncryptedFileName { get; set; } = string.Empty;

        public string Payload { get; set; } = string.Empty;
        public string InitializationVector { get; set; } = string.Empty;
        public string AuthenticationTag { get; set; } = string.Empty;
    }
}
