using System;

namespace Encrypz.Core.Entities
{
    public class ConnectedGoogleAccount
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public string GoogleSubject { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? DisplayName { get; set; }
        public string RefreshToken { get; set; } = string.Empty;
        public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;
    }
}
