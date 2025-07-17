export class TestGenerator {
    async generateFromNaturalLanguage(request) {
        // For now, just delegate to the NaturalLanguageProcessor (could be extended)
        return {
            testName: request.testName,
            code: `// Generated test for: ${request.description}`,
            steps: [request.description]
        };
    }
}
//# sourceMappingURL=TestGenerator-enhanced.js.map