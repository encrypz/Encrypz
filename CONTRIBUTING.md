# Contributing to Encrypz

First off, thank you for considering contributing to Encrypz! It's people like you that make Encrypz a powerful, secure zero-knowledge platform.

## Local Setup

To set up the project locally for development, follow these steps:

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/YOUR_USERNAME/Encrypz.git
    cd Encrypz
    ```
3.  **Install the .NET 8 SDK**, if you haven't already.
4.  **Restore dependencies and build:**
    ```bash
    dotnet restore
    dotnet build
    ```
5.  **Create a branch** for your feature or bug fix:
    ```bash
    git checkout -b feature/your-feature-name
    ```

## Separation of Concerns

Encrypz strictly follows a clean, layered architecture to maintain a secure and maintainable codebase. When submitting pull requests, please ensure you adhere to the following rules:

*   **Encrypz.Core:** This layer contains domain models and business rules. It **must not** reference any infrastructure or presentation projects. Do not add database-specific attributes, UI concerns, or framework dependencies here.
*   **Encrypz.Infrastructure:** This layer implements the interfaces defined in the Core layer. All database interactions, file system access, and external API calls must reside here. It may reference `Encrypz.Core`.
*   **Encrypz.API:** This layer should only contain controllers, middleware, and setup logic. It should not contain business logic. It orchestrates calls to the application services defined in the Core layer. It may reference `Encrypz.Core` and `Encrypz.Infrastructure`.

**Pull requests that violate these architectural boundaries will not be merged.**

## Issue Templates

Before starting work on a major feature, please create an issue to discuss it. We provide issue templates to help you structure your bug reports and feature requests.

*   [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md)
*   [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md)

*(Note: If the `.github/ISSUE_TEMPLATE` folder does not exist yet, you can just create a standard GitHub issue and clearly state whether it is a bug or a feature request.)*

## Submitting a Pull Request

1.  Commit your changes with clear, descriptive commit messages.
2.  Push your branch to your fork.
3.  Open a Pull Request against the `main` branch of the upstream repository.
4.  Ensure all CI checks pass.
