using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Encrypz.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GoogleDriveIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Payload",
                table: "EncryptedFiles");

            migrationBuilder.AddColumn<string>(
                name: "GoogleRefreshToken",
                table: "Users",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "GoogleDriveFileId",
                table: "EncryptedFiles",
                type: "varchar(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GoogleRefreshToken",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "GoogleDriveFileId",
                table: "EncryptedFiles");

            migrationBuilder.AddColumn<byte[]>(
                name: "Payload",
                table: "EncryptedFiles",
                type: "LONGBLOB",
                nullable: false);
        }
    }
}
