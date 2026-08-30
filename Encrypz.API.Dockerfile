# Place this file at the root of the Encrypz repo (next to Encrypz.slnx)
# Build:  docker build -f Encrypz.API.Dockerfile -t encrypz-api .

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Encrypz.API/Encrypz.API.csproj Encrypz.API/
COPY Encrypz.Core/Encrypz.Core.csproj Encrypz.Core/
COPY Encrypz.Infrastructure/Encrypz.Infrastructure.csproj Encrypz.Infrastructure/
RUN dotnet restore Encrypz.API/Encrypz.API.csproj

COPY Encrypz.API/ Encrypz.API/
COPY Encrypz.Core/ Encrypz.Core/
COPY Encrypz.Infrastructure/ Encrypz.Infrastructure/

WORKDIR /src/Encrypz.API
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Encrypz.API.dll"]
