using Encrypz.Core.Entities;
using Encrypz.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;
using Xunit;

namespace Encrypz.Tests;

public class MongoModelTests
{
    [Fact]
    public void MongoModelKeepsReferencesAsIdsAndSupportsEncryptedBinaryData()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseMongoDB(new MongoClient("mongodb://localhost:27017"), "EncrypzTests").Options);
        var entities = db.Model.GetEntityTypes().ToArray();
        Assert.Equal(3, entities.Length);
        Assert.All(entities, entity => Assert.Empty(entity.GetForeignKeys()));
        Assert.All(entities, entity => Assert.Empty(entity.GetNavigations()));
        Assert.Equal(typeof(Guid), db.Model.FindEntityType(typeof(User))!.FindPrimaryKey()!.Properties.Single().ClrType);
        Assert.Equal(typeof(byte[]), db.Model.FindEntityType(typeof(EncryptedFile))!
            .FindProperty(nameof(EncryptedFile.EncryptedFileName))!.ClrType);
    }
}
