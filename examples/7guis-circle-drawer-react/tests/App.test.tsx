import { render, screen, fireEvent } from "@testing-library/react";
import App from "@/App";

describe("Circle Drawer", () => {
  render(<App />);
  it("Ensure all controls are disabled", () => {
    const undoButton = screen.getByRole("button", { name: /undo/i });
    const redoButton = screen.getByRole("button", { name: /redo/i });
    const colorPicker = screen.getByLabelText(/color/i);
    const sizeInput = screen.getByLabelText(/size/i);
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();
    expect(colorPicker).toBeDisabled();
    expect(sizeInput).toBeDisabled();
  });

  it("Ensure circle is created and selected when pointer touches stage", () => {
    render(<App />);
    const stage = screen.getByTestId("stage");
    fireEvent.pointerDown(stage);
    const circle = screen.getByTestId("circle-1");
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute(
      "style",
      expect.stringContaining("outline: 2px")
    );
  });

  it("Ensure all inputs but redo are enabled when first circle is created", () => {
    render(<App />);
    const stage = screen.getByTestId("stage");
    const undoButton = screen.getByRole("button", { name: /undo/i });
    const redoButton = screen.getByRole("button", { name: /redo/i });
    const colorPicker = screen.getByLabelText(/color/i);
    const sizeInput = screen.getByLabelText(/size/i);
    fireEvent.pointerDown(stage);
    expect(undoButton).not.toBeDisabled();
    expect(redoButton).toBeDisabled();
    expect(colorPicker).not.toBeDisabled();
    expect(sizeInput).not.toBeDisabled();
  });

  it("Ensure undo button is enabled when circle is created", () => {
    render(<App />);
    const stage = screen.getByTestId("stage");
    const undoButton = screen.getByRole("button", { name: /undo/i });
    fireEvent.pointerDown(stage);
    expect(undoButton).not.toBeDisabled();
  });

  it("Ensure redo button is disabled when circle is created", () => {
    render(<App />);
    const stage = screen.getByTestId("stage");
    const redoButton = screen.getByRole("button", { name: /redo/i });
    fireEvent.pointerDown(stage);
    expect(redoButton).toBeDisabled();
  });

  it("Ensure redo button is enabled when redo is possible", () => {
    render(<App />);
    const undoButton = screen.getByRole("button", { name: /undo/i });
    const stage = screen.getByTestId("stage");
    fireEvent.pointerDown(stage);
    fireEvent.click(undoButton);
    expect(undoButton).not.toBeDisabled();
  });

  it("Ensure undo button is disabled when undo is not possible", () => {
    render(<App />);
    const redoButton = screen.getByRole("button", { name: /redo/i });
    const stage = screen.getByTestId("stage");
    fireEvent.pointerDown(stage);
    const undoButton = screen.getByRole("button", { name: /undo/i });
    fireEvent.click(undoButton);
    expect(redoButton).toBeDisabled();
  });

  it("Ensure redo button is disabled when redo is not possible", () => {
    render(<App />);
    const redoButton = screen.getByRole("button", { name: /redo/i });
    const stage = screen.getByTestId("stage");
    fireEvent.pointerDown(stage);
    const undoButton = screen.getByRole("button", { name: /undo/i });
    fireEvent.click(undoButton);
    fireEvent.click(redoButton);
    expect(redoButton).toBeDisabled();
  });

  it("Ensure undo button is enabled when redo is possible", () => {
    render(<App />);
    const undoButton = screen.getByRole("button", { name: /undo/i });
    const stage = screen.getByTestId("stage");
    fireEvent.pointerDown(stage);
    fireEvent.click(undoButton);
    const redoButton = screen.getByRole("button", { name: /redo/i });
    fireEvent.click(redoButton);
    expect(undoButton).not.toBeDisabled();
  });

  it("Ensure circle is recreated when redo is clicked", () => {
    render(<App />);
    const stage = screen.getByTestId("stage");
    fireEvent.pointerDown(stage);
    const undoButton = screen.getByRole("button", { name: /undo/i });
    fireEvent.click(undoButton);
    const redoButton = screen.getByRole("button", { name: /redo/i });
    fireEvent.click(redoButton);
    const circle = screen.getByTestId("circle-1");
    expect(circle).toBeInTheDocument();
  });

  it("Ensure circles are recreated when redo is clicked twice", () => {
    render(<App />);
    const stage = screen.getByTestId("stage");
    fireEvent.pointerDown(stage);
    fireEvent.pointerDown(stage);
    const undoButton = screen.getByRole("button", { name: /undo/i });
    fireEvent.click(undoButton);
    fireEvent.click(undoButton);
    const redoButton = screen.getByRole("button", { name: /redo/i });
    fireEvent.click(redoButton);
    fireEvent.click(redoButton);
    const circle = screen.getByTestId("circle-1");
    expect(circle).toBeInTheDocument();
  });

  it("Ensure circle is recreated when redo is clicked after undo", () => {
    render(<App />);
    const stage = screen.getByTestId("stage");
    fireEvent.pointerDown(stage);
    const undoButton = screen.getByRole("button", { name: /undo/i });
    const redoButton = screen.getByRole("button", { name: /redo/i });
    fireEvent.click(undoButton);
    fireEvent.click(redoButton);
    const circle = screen.getByTestId("circle-1");
    expect(circle).toBeInTheDocument();
  });
});
