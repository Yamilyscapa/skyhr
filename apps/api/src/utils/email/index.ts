import { Resend } from "resend";
import { render } from "@react-email/render";
import InvitationEmail from "../../../emails/invitation-email";

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to: string, subject: string, html: string) => {
    const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

    if (!FROM_EMAIL) {
        throw new Error("RESEND_FROM_EMAIL is not set");
    }

    try {
        const { data, error } = await resend.emails.send({
            from: `SkyHR <${FROM_EMAIL}>`,
            to,
            subject,
            html
        });

        if (error) {
            console.error("Error sending email:", error);
            throw new Error("Error sending email");
        }

        return data;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}

export const SendInvitationEmail = async (to: string, inviteLink: string, organizationName: string) => {
    try {
        const emailHtml = await render(InvitationEmail({ inviteLink, organizationName }));

        return await sendEmail(to, `Invitación para unirse a ${organizationName}`, emailHtml);
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
};
