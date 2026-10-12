FROM node:24-bookworm-slim AS frontend
WORKDIR /ui
COPY Encrypz.UI/package*.json ./
RUN npm ci
COPY Encrypz.UI/ ./
ENV VITE_API_URL=/api
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend
WORKDIR /src
COPY Encrypz.API/Encrypz.API.csproj Encrypz.API/
COPY Encrypz.Core/Encrypz.Core.csproj Encrypz.Core/
COPY Encrypz.Infrastructure/Encrypz.Infrastructure.csproj Encrypz.Infrastructure/
RUN dotnet restore Encrypz.API/Encrypz.API.csproj
COPY Encrypz.API/ Encrypz.API/
COPY Encrypz.Core/ Encrypz.Core/
COPY Encrypz.Infrastructure/ Encrypz.Infrastructure/
RUN dotnet publish Encrypz.API/Encrypz.API.csproj -c Release -o /publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=backend /publish ./
COPY --from=frontend /ui/dist ./wwwroot
ENV ASPNETCORE_ENVIRONMENT=Production
CMD ["dotnet", "Encrypz.API.dll"]
