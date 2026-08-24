# Encrypz

Encrypz is a secure, zero-knowledge end-to-end encryption web application. Designed with privacy as the highest priority, Encrypz ensures that your sensitive data remains entirely secure and inaccessible to anyone except you.

## Features

*   **Zero-Knowledge Architecture:** The server never sees the plain text of your data or the keys used to encrypt it.
*   **End-to-End Encryption:** Data is encrypted on the client side before transmission and decrypted only upon retrieval by the authorized user.
*   **Layered Architecture:** Built on a clean, scalable .NET 8 architecture, ensuring separation of concerns and maintainability.
*   **RESTful API:** A robust API built with ASP.NET Core.

## Architecture

Encrypz follows a clean, layered architecture pattern, implemented in .NET 8.

*   **Encrypz.API (Presentation Layer):** An ASP.NET Core Web API using controllers. This layer is responsible for handling incoming HTTP requests, routing them to the appropriate services, and returning responses. It relies on the Core layer for business logic and the Infrastructure layer for data access and external services.
*   **Encrypz.Core (Domain & Application Layer):** The heart of the application. It contains the enterprise logic, domain models, interfaces, and application-specific business rules. This layer has no dependencies on external frameworks or infrastructure concerns.
*   **Encrypz.Infrastructure (Data & External Services Layer):** Implements the interfaces defined in the Core layer. This layer handles database access, external API calls, cryptography implementations, and other infrastructure-specific concerns.

## Getting Started

### Prerequisites

*   [.NET 8 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
*   [Git](https://git-scm.com/)

### Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-org/Encrypz.git
    cd Encrypz
    ```

2.  Restore the dependencies:
    ```bash
    dotnet restore
    ```

3.  Build the solution:
    ```bash
    dotnet build
    ```

4.  Run the API:
    ```bash
    cd Encrypz.API
    dotnet run
    ```
