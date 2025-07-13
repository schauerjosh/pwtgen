# vCreative Playwright Test Generator & Knowledge Base (RAG Pipeline)

This project automates Playwright test generation for vProMedia using a Retrieval-Augmented Generation (RAG) pipeline and a structured knowledge base. It streamlines QA automation by integrating JIRA card parsing, semantic search, environment selection, fixture creation, and mock data support.

## Features
- **JIRA Card Parsing:** CLI ingests JIRA ticket, extracts title, description, and acceptance criteria.
- **Action & Role Extraction:** Automatically detects required actions, roles, and entities (e.g., login, spot, user, station) from card text.
- **Semantic Search (RAG):** Queries the vProMedia knowledge base using OpenAI embeddings to retrieve relevant business actions and guidance for each detected step.
- **Environment Selection:** Prompts for environment/domain to run Playwright tests.
- **Fixture & Mock Data Creation:** Prompts for required data (spot, user, station, firm, adtype) and supports mock data presets for rapid test setup.
- **Playwright Test Generation:** Uses OpenAI to generate Playwright tests based on all gathered context.
- **Developer Guidance:** CLI provides actionable instructions, context, and summaries at each step.
- **Playwright Test Recording:** Record browser actions interactively and generate Playwright test code with JIRA integration.

## Knowledge Base Structure
- `actions.json`: Structured business actions and UI steps for vProMedia automation.
- `articles.json`: Full content of 32 vProMedia knowledge base articles (used for semantic search).
- `embeddings.json`: OpenAI embeddings for business actions.
- `article_embeddings.json`: OpenAI embeddings for knowledge base articles.

## Mock Data
- Located in `src/app/mock-data/`
- Only valid presets are used for spot, user, station, firm, and adtype when mock data is selected.
- Developer can choose to use mock data or provide specific data for required entities.

## CLI Workflow
### 1. Generate Playwright Test (`pwtgen gen`)
1. **Run CLI:** `pwtgen gen`
2. **JIRA Ticket:** Enter the JIRA ticket number.
3. **Knowledge Base Search:** CLI parses card, extracts actions/roles, and queries the knowledge base for guidance on each step.
4. **Entity Detection:** CLI detects required entities (spot, user, station, firm, adtype) from card text.
5. **Mock Data Prompt:** Developer chooses to use mock data or provide specific data for each entity.
6. **Test File Location:** Enter the file path to save the Playwright test.
7. **Summary:** CLI displays a summary of all choices, detected entities, and data used.
8. **Test Generation:** Playwright test is generated using all gathered context and saved to the specified location.

### 2. Record Playwright Test (`pwtgen record`)
- **Purpose:** Launches an interactive browser session to record user actions and generate Playwright test code, optionally linked to a JIRA card.
- **Workflow:**
  1. Run CLI: `pwtgen record`
  2. CLI launches a browser in recording mode.
  3. Developer performs the desired actions in the browser (navigation, clicks, form fills, etc.).
  4. CLI captures all actions and generates Playwright test code based on the recording.
  5. Optionally, the CLI can prompt for a JIRA ticket to link the recording to a specific card.
  6. CLI saves the generated test code to the specified file location.
  7. Developer can review, edit, and run the recorded test as needed.
- **Integration:**
  - Recorded tests can be used as a starting point for further automation, or combined with generated tests from the `gen` workflow.
  - JIRA integration ensures traceability between manual recordings and QA requirements.

#### Example `pwtgen record` Session
```
$ pwtgen record
Launching browser in recording mode...
Perform actions in the browser to record your test steps.
(Optional) Enter JIRA ticket number to link this recording: QA-279
Path to save the Playwright test file: tests/QA-279-recorded.spec.ts
Recording complete. Generated Playwright test:
// ...recorded test code...
```

## Semantic Search (RAG)
- Uses OpenAI embeddings to match developer queries and detected actions/roles to relevant knowledge base articles.
- Returns top matching articles with actionable guidance and context for each step.
- Enables developers to follow best practices and business logic directly from the knowledge base.

## Example Actions
- Login as Demo Prod Director
- Create spot with file attachment
- Send email from notes section
- Verify email notification

## Example CLI Session (`gen`)
```
$ pwtgen gen
Enter the Jira ticket number: QA-279
Entities required for this test (detected from card): spot, user
Do you want to use mock data for the required entities (spot, user)? (Y/n): Y
Using mock spot data (spotPresets.valid): {...}
Using mock user data (userPresets.valid): {...}
Path to save the Playwright test file: tests/QA-279.spec.ts
Summary:
JIRA Ticket: QA-279
Test file location: /absolute/path/to/tests/QA-279.spec.ts
Required entities: spot, user
Using mock data for entities.
Searching knowledge base for: "log in as Demo Prod Director" ...
[1] Clearing Cache in vProMedia
URL: https://vcreativeinc.com/knowledge/clearing-cache-in-vpromedia
Score: 0.872
Content: ...
...
Generating Playwright test using OpenAI...
Generated Playwright Test:
// ...test code...
```

## How to Extend
- Add new business actions to `actions.json` and regenerate embeddings.
- Add new knowledge base articles to `articles.json` and regenerate embeddings.
- Update mock data presets in `src/app/mock-data/` as needed.
- Refine semantic search logic in the CLI for improved matching.
- Use `pwtgen record` to capture new manual workflows and expand test coverage.

## Troubleshooting
- Ensure OpenAI API key is set in config.
- Regenerate embeddings after updating knowledge base files.
- Use mock data for rapid prototyping and testing.
- Use `pwtgen record` for manual workflow capture and debugging.

## Contact & Support
For questions, feature requests, or support, contact the vCreative QA Automation team.
