/**
 * lib/agent/diagnose.test.ts
 * Unit tests for the deterministic diagnosis function.
 * Run with: pnpm test
 */
import { diagnose } from "./diagnose";

describe("diagnose()", () => {
  const result = diagnose();

  test("gap is ₹65,000", () => {
    expect(result.gap).toBe(65000);
  });

  test("gap percentage is -32.5%", () => {
    expect(result.gapPct).toBe(32.5);
  });

  test("orders decline is -32.5%", () => {
    expect(result.ordersPct).toBe(32.5);
  });

  test("ASP change is 0%", () => {
    expect(result.aspChange).toBe(0);
  });

  test("cancellation loss is ₹8,100", () => {
    expect(result.cancellationLoss).toBe(8100);
  });

  test("stockout + visibility loss is ₹56,900", () => {
    expect(result.stockoutVisibilityLoss).toBe(56900);
  });

  test("gap = cancellationLoss + stockoutVisibilityLoss", () => {
    expect(result.cancellationLoss + result.stockoutVisibilityLoss).toBe(
      result.gap
    );
  });

  test("ranked causes has 2 entries", () => {
    expect(result.rankedCauses).toHaveLength(2);
  });

  test("stockout cause is ranked first", () => {
    expect(result.rankedCauses[0].cause).toBe("stockout_visibility");
  });

  test("confidence is high", () => {
    expect(result.confidence).toBe("high");
  });
});

