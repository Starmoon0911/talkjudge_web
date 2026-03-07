export interface Sample {
    input: string;
    output: string;
    explanation?: string;
}

export interface TestCase {
    input: string;
    output: string;
}

export interface IProblem {
    id:string,
    title: string;
    slug: string;
    difficulty: 'easy' | 'medium' | 'hard';
    tags: string[];
    description: string;
    input_format: string;
    output_format: string;
    constraints: string;
    time_limit: number;
    memory_limit: number;
    samples: Sample[];
    testcases: TestCase[];
    solution_code?: string;
    created_at: Date;
    updated_at?: Date;
}