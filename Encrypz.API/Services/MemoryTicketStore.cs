using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Cryptography;

namespace Encrypz.API.Services;

// The browser receives only an opaque handle. OAuth tokens never enter its cookie.
// Sessions deliberately expire on restart; no persistent token database is needed.
public sealed class MemoryTicketStore(IMemoryCache cache) : ITicketStore
{
    public Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        var key = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        return Store(key, ticket);
    }
    private async Task<string> Store(string key, AuthenticationTicket ticket)
    {
        await RenewAsync(key, ticket);
        return key;
    }
    public Task RenewAsync(string key, AuthenticationTicket ticket)
    {
        cache.Set("ticket:" + key, ticket, ticket.Properties.ExpiresUtc ?? DateTimeOffset.UtcNow.AddMinutes(50));
        return Task.CompletedTask;
    }
    public Task<AuthenticationTicket?> RetrieveAsync(string key) => Task.FromResult(cache.Get<AuthenticationTicket>("ticket:" + key));
    public Task RemoveAsync(string key) { cache.Remove("ticket:" + key); return Task.CompletedTask; }
}
