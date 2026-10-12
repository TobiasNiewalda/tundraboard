import nodemailer from "nodemailer";

export interface AssignmentEmailInput {
  to: string;
  taskId: string;
  taskTitle: string;
}

export async function sendAssignmentEmail(
  input: AssignmentEmailInput,
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_PORT === "465",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: input.to,
    subject: `You have been assigned to task: ${input.taskTitle}`,
    text: [
      `You have been assigned to task ${input.taskId}.`,
      `Title: ${input.taskTitle}`,
    ].join("\n"),
  });
}
