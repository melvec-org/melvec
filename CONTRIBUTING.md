# Contributing to Melvec

**We can make the world better together.**

Thank you for your interest in contributing to this project. This is a **free and open-source software** (with semi-open contribution model). All contributions are voluntary — we cannot promise any financial compensation or guarantees.

This project follows an **invite-only contribution model**. Only invited contributors can submit code, documentation, or tests. If you are interested in contributing, please reach out to a core team member with your GitHub/GitLab username and a brief note about what you'd like to work on.

## Ways to Contribute

There are several valuable ways to support the project:

1. **Developing new features or fixing bugs**
2. **Testing the software** (manual or automated)
3. **Improving documentation**
4. **Reporting bugs and suggesting features** (even without code)

---

## Becoming a Contributor

1. Express interest by contacting a core team member.
2. Once approved, you will be added to the private contributor group.
3. You will receive access to the internal roadmap, issue tracker, and development discussions.

---

## Development Workflow (Features & Bug Fixes)

When working on a feature or bug fix, please follow this recommended cycle:

1. **Pick or create an issue**
    - Check the project’s issue tracker for existing tasks.
    - If your idea is not listed, open a new issue first and discuss it with the core team before starting heavy work.

2. **Set up your development environment**
    - Follow the instructions in [`development.md`](dev-docs/development.md)

3. **Create a branch**
    - Use a meaningful branch name: `feature/xxx`, `bugfix/yyy`, `docs/zzz`, etc.

4. **Develop the changes**
    - Follow the project's coding standards and architecture.
    - Keep changes focused and atomic (one logical change per PR).

5. **Write or update tests**
    - Add unit, integration, or end-to-end tests as appropriate.
    - Ensure existing tests continue to pass.

6. **Update documentation**
    - Update relevant docs, README, API references, or changelog.

7. **Commit and push**
    - Write clear, conventional commit messages.
    - Reference the issue number (`Closes #123` or `Fixes #123`).

8. **Submit a Pull Request**
    - Fill out the PR template completely.
    - Provide context, motivation, and technical decisions.
    - Link the related issue(s).
    - Tag 1–2 members from the **core approver group** for review.

9. **Address review feedback**
    - Respond to comments and make requested changes promptly.
    - Keep the PR up-to-date with the main branch.

---

## Coding Standards

- Follow the existing code style (we use linting tools — run them locally before submitting).
- Write meaningful variable/function names.
- Keep functions small and focused.
- Add comments for complex logic.
- Maintain backward compatibility unless explicitly agreed.

## Testing Guidelines

- All new features should have accompanying tests.
- Bug fixes should include regression tests.
- Manually test your changes thoroughly before opening a PR.
- For major changes, consider adding integration or E2E tests.

## Documentation

Good documentation is as important as good code. Please:

- Update the README if user-facing changes are made.
- Document new APIs, configuration options, or architecture decisions.
- Keep language clear, concise, and inclusive.

## Changelog maintenance policy

Maintain `CHANGELOG.md` for the lifetime of the project. Add notable release-worthy changes under `Unreleased` during development, then move them into a versioned section at release time. Keep entries concise and meaningful; do not use the changelog as a commit-by-commit activity log.

## Pull Request Guidelines

- **Title**: Clear and descriptive (e.g., "feat: add user authentication flow").
- **Description**: Explain _what_ and _why_. Include screenshots or recordings for UI changes.
- **Scope**: One PR = one purpose. Large changes should be broken into smaller PRs when possible.
- **Status**: Mark as Draft while work is in progress.

We use **Conventional Commits** and **Semantic Versioning**.

## Code Review Process

- At least one approval from the core team is required.
- Reviewers will check for correctness, performance, security, and maintainability.
- All discussions should remain professional and constructive.

## Recognition

All contributors will be:

- Added to the `CONTRIBUTORS.md` or `CREDITS.md` file.
- Mentioned in release notes when appropriate.

---

## Code of Conduct

By participating in this project, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md). We expect respectful and professional communication at all times.

---

## Questions?

Feel free to ask questions in the `#contributors` (or equivalent) discussion channel or by opening a Discussion issue.

**Thank you again for helping make this project better!** 🚀
