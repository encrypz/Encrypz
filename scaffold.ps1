$ErrorActionPreference = "Stop"

# 1. Create a new blank solution named Encrypz
Write-Host "Creating Solution..."
dotnet new sln -n Encrypz

# 2. Create an ASP.NET Core Web API project named Encrypz.API (without top-level statements, using controllers)
Write-Host "Creating Encrypz.API..."
dotnet new webapi -n Encrypz.API -f net8.0 --use-controllers --use-program-main

# 3. Create two Class Library projects named Encrypz.Core and Encrypz.Infrastructure
Write-Host "Creating Encrypz.Core..."
dotnet new classlib -n Encrypz.Core -f net8.0
Write-Host "Creating Encrypz.Infrastructure..."
dotnet new classlib -n Encrypz.Infrastructure -f net8.0

# 4. Add all three projects to the solution
Write-Host "Adding projects to solution..."
dotnet sln add Encrypz.API/Encrypz.API.csproj
dotnet sln add Encrypz.Core/Encrypz.Core.csproj
dotnet sln add Encrypz.Infrastructure/Encrypz.Infrastructure.csproj

# 5. Set up the project references
Write-Host "Setting up project references..."
# Infrastructure references Core
dotnet add Encrypz.Infrastructure/Encrypz.Infrastructure.csproj reference Encrypz.Core/Encrypz.Core.csproj
# API references Core and Infrastructure
dotnet add Encrypz.API/Encrypz.API.csproj reference Encrypz.Core/Encrypz.Core.csproj
dotnet add Encrypz.API/Encrypz.API.csproj reference Encrypz.Infrastructure/Encrypz.Infrastructure.csproj

# 6. Initialize a Git repository and generate a standard .NET .gitignore file
Write-Host "Initializing Git repository and adding .gitignore..."
git init
dotnet new gitignore

Write-Host "Scaffolding complete!"
