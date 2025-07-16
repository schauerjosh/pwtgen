# vProMedia Knowledge Base

This knowledge base contains comprehensive information for generating Playwright tests for the vProMedia application.

## Structure

### 📁 selectors/
Contains all UI selectors organized by functionality:
- `vpromedia-selectors.md` - Complete selector reference for forms, navigation, POC assignment, etc.

### 📁 workflows/
Step-by-step workflows for common business processes:
- `login-workflow.md` - Authentication and login process
- `spot-creation-workflow.md` - Creating spots/orders/quick orders
- `poc-assignment-workflow.md` - Assigning points of contact

### 📁 fixtures/
Test data and configuration:
- `test-users.md` - Valid and invalid user credentials
- `spot-data.md` - Spot data structures and test data

### 📁 patterns/
Best practices and common patterns:
- `playwright-best-practices.md` - Coding patterns, error handling, retry logic

## Usage

This knowledge base is designed to be consumed by a RAG (Retrieval-Augmented Generation) system that will:

1. **Parse Jira tickets** for business requirements
2. **Query this knowledge base** for relevant selectors, workflows, and patterns
3. **Generate Playwright tests** using the retrieved context
4. **Apply best practices** from the patterns section

## Key Features

- **Real selectors** extracted from actual application usage
- **Complete workflows** with step-by-step instructions and code examples
- **Test data fixtures** for both positive and negative testing scenarios
- **Best practices** to ensure generated tests are robust and maintainable

## Test Users

The knowledge base includes several test users for different roles:
- Production Director
- Traffic Director  
- General Test User (with ghost capabilities)

## Environments

Supports multiple environments:
- Development: `https://dev.vcreative.net`
- Test: `https://two-test.vcreative.net`
- Staging: `https://staging.vcreative.net`
- Production: `https://vcreative.net`

## File Formats Supported

The application supports various file formats for uploads:
- Audio: .mp3
- Video: .mp4, .mov
- Images: .jpg, .jpeg
- Documents: Various formats as configured

## Contributing

When adding new content to this knowledge base:

1. Follow the existing markdown structure with frontmatter
2. Include both step-by-step instructions and code examples
3. Use real selectors from the application
4. Add appropriate metadata tags for categorization
5. Include error handling and edge cases
