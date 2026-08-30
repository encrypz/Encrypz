using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Encrypz.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddThumbnailsToFile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "EncryptedThumbnail",
                table: "EncryptedFiles",
                type: "longblob",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "ThumbnailAuthTag",
                table: "EncryptedFiles",
                type: "longblob",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "ThumbnailIv",
                table: "EncryptedFiles",
                type: "longblob",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EncryptedThumbnail",
                table: "EncryptedFiles");

            migrationBuilder.DropColumn(
                name: "ThumbnailAuthTag",
                table: "EncryptedFiles");

            migrationBuilder.DropColumn(
                name: "ThumbnailIv",
                table: "EncryptedFiles");
        }
    }
}
