import { buildLocalEmbedding, cosineSimilarity, segmentText } from './document-knowledge.util'

describe('document-knowledge utilities', () => {
	it('segments long text into ordered slices', () => {
		const text = `
		INTRODUCTION

		This filing covers multiple issues.

		Background facts and procedural posture are outlined here.

		FINDINGS OF FACT

		The tribunal considered testimony and written evidence.

		CONCLUSIONS OF LAW

		The court grants partial relief.
		`

		const segments = segmentText(text, 80)
		expect(segments.length).toBeGreaterThan(2)
		expect(segments[0].position).toBe(0)
		expect(segments.every((seg, idx) => seg.position === idx)).toBe(true)
	})

	it('produces deterministic local embeddings', () => {
		const first = buildLocalEmbedding('Alpha beta alpha')
		const second = buildLocalEmbedding('Alpha beta alpha')
		expect(first).toEqual(second)
		expect(first.length).toBeGreaterThan(0)
	})

	it('computes cosine similarity scores', () => {
		const score = cosineSimilarity([1, 0, 0], [1, 0, 0])
		expect(score).toBeCloseTo(1)
		const distant = cosineSimilarity([1, 0], [0, 1])
		expect(distant).toBeCloseTo(0)
	})
})
