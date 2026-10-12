using Encrypz.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Encrypz.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261012000000_GoogleSignIn")]
public partial class GoogleSignIn : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "DataProtectionKeys",
            columns: table => new
            {
                Id = table.Column<int>(type: "int", nullable: false)
                    .Annotation("MySql:ValueGenerationStrategy", Microsoft.EntityFrameworkCore.Metadata.MySqlValueGenerationStrategy.IdentityColumn),
                FriendlyName = table.Column<string>(type: "longtext", nullable: true),
                Xml = table.Column<string>(type: "longtext", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_DataProtectionKeys", x => x.Id));
        migrationBuilder.AddColumn<string>(
            name: "GoogleSubject", table: "Users", type: "varchar(255)",
            maxLength: 255, nullable: true);
        migrationBuilder.CreateIndex(
            name: "IX_Users_GoogleSubject", table: "Users", column: "GoogleSubject", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "DataProtectionKeys");
        migrationBuilder.DropIndex(name: "IX_Users_GoogleSubject", table: "Users");
        migrationBuilder.DropColumn(name: "GoogleSubject", table: "Users");
    }
}
