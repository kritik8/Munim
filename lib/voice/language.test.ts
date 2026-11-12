import { containsDevanagari, detectTextLanguage } from "./language";

describe("language detection", () => {
  it("detects Devanagari script", () => {
    expect(containsDevanagari("मेरी बिक्री कम हो गई है")).toBe(true);
    expect(containsDevanagari("My sales dropped this month")).toBe(false);
    expect(containsDevanagari("Haan sales gir gayi hai")).toBe(false);
  });

  it("classifies pure English sentences as 'en' even if STT code hints hi-IN", () => {
    expect(
      detectTextLanguage("My sales dropped significantly this month", "hi-IN")
    ).toBe("en");
    expect(
      detectTextLanguage("Hello I am Rakesh from Rakesh Traders", "en-IN")
    ).toBe("en");
    expect(
      detectTextLanguage("Your orders fell by thirty two point five percent")
    ).toBe("en");
  });

  it("classifies Hinglish sentences as 'hinglish'", () => {
    expect(detectTextLanguage("Haan, sales gir gayi hai")).toBe("hinglish");
    expect(
      detectTextLanguage("Namaste, main Priya bol rahi hoon Jaipur se")
    ).toBe("hinglish");
    expect(
      detectTextLanguage("Pichle mahine ke mukable orders kam ho gaye hain")
    ).toBe("hinglish");
  });

  it("classifies Devanagari text as 'hinglish'", () => {
    expect(detectTextLanguage("मेरी बिक्री कम हो गई है")).toBe("hinglish");
  });
});

