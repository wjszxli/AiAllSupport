import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';

export function createStructuredOutputParser(schema: z.ZodType) {
    return StructuredOutputParser.fromZodSchema(schema);
}
