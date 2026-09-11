import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SaveFormButton } from "./save-form-button";

describe("SaveFormButton", () => {
  afterEach(() => cleanup());
  it("disables when clean and not saving", () => {
    render(<SaveFormButton isDirty={false} saving={false} />);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("enables when dirty", () => {
    render(<SaveFormButton isDirty saving={false} />);
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });

  it("allows save when clean if allowSaveWhenClean", () => {
    render(<SaveFormButton isDirty={false} allowSaveWhenClean />);
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });

  it("shows saving label while saving", () => {
    render(<SaveFormButton isDirty saving />);
    expect(screen.getByRole("button", { name: "保存中…" })).toBeDisabled();
  });
});
