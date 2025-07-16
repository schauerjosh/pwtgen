import type { RAGContext } from '../types/index.js';
export declare class VectraRAGService {
    private index;
    private embed;
    private initialized;
    init(): Promise<void>;
    ingestKnowledgeBase(): Promise<void>;
    query(text: string, topK?: number, minScore?: number): Promise<RAGContext[]>;
    private generateEmbedding;
    private walkDirectory;
    private isSupportedFile;
    private inferType;
    private stripFrontMatter;
    private createSampleKnowledgeBase;
}
//# sourceMappingURL=VectraRAGService.d.ts.map