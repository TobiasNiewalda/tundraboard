import { beforeEach, describe, expect, it, vi } from "vitest";

const mailerMocks = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  createTransportMock: vi.fn(),
}));

mailerMocks.createTransportMock.mockImplementation(() => ({
  sendMail: mailerMocks.sendMailMock,
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mailerMocks.createTransportMock,
  },
}));

import { sendAssignmentEmail } from "../src/services/emailService.js";

describe("sendAssignmentEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "sender@example.com";
    process.env.SMTP_PASS = "secret";
  });

  it("sends an assignment email through nodemailer", async () => {
    await sendAssignmentEmail({
      to: "assignee@example.com",
      taskId: "task-1",
      taskTitle: "Ship lesson",
    });

    expect(mailerMocks.createTransportMock).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: {
        user: "sender@example.com",
        pass: "secret",
      },
    });
    expect(mailerMocks.sendMailMock).toHaveBeenCalledWith({
      from: "sender@example.com",
      to: "assignee@example.com",
      subject: "You have been assigned to task: Ship lesson",
      text: "You have been assigned to task task-1.\nTitle: Ship lesson",
    });
  });
});
