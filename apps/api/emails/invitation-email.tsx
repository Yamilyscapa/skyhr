import React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Heading,
  Link,
  Section,
  Button,
  Hr,
} from "@react-email/components";

type InvitationEmailProps = {
  inviteLink: string;
  organizationName: string;
};

export default function InvitationEmail({ inviteLink, organizationName }: InvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Heading style={logoStyle}>sky hr</Heading>
          </Section>

          {/* Main Content Card */}
          <Section style={cardStyle}>
            <Heading style={headingStyle}>
              Invitación para unirse a {organizationName ?? 'nombre no disponible'}
            </Heading>
            
            <Text style={textStyle}>
              Estás invitado a unirse a <strong>{organizationName ?? 'nombre no disponible'}</strong>. 
              Haz clic en el botón a continuación para aceptar la invitación y comenzar a usar SkyHR.
            </Text>

            <Section style={buttonContainerStyle}>
              <Button href={inviteLink} style={buttonStyle}>
                Aceptar invitación
              </Button>
            </Section>

            <Hr style={dividerStyle} />

            <Text style={secondaryTextStyle}>
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </Text>
            <Link href={inviteLink} style={linkStyle}>
              {inviteLink}
            </Link>
          </Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Este es un correo automático, por favor no respondas.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles matching the application design
const bodyStyle = {
  backgroundColor: "#f5f5f5",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: 0,
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
};

const containerStyle = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "#f5f5f5",
  padding: "20px",
};

const headerStyle = {
  backgroundColor: "#ffffff",
  padding: "24px 32px",
  borderRadius: "8px 8px 0 0",
  borderBottom: "1px solid #e5e5e5",
};

const logoStyle = {
  margin: 0,
  fontSize: "24px",
  fontWeight: "600",
  color: "#1a1a1a",
  letterSpacing: "-0.5px",
  textTransform: "lowercase" as const,
};

const cardStyle = {
  backgroundColor: "#ffffff",
  padding: "32px",
  borderRadius: "0 0 8px 8px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const headingStyle = {
  fontSize: "24px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 24px 0",
  lineHeight: "1.4",
};

const textStyle = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#4a4a4a",
  margin: "0 0 16px 0",
};

const buttonContainerStyle = {
  margin: "32px 0",
  textAlign: "center" as const,
};

const buttonStyle = {
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "500",
  padding: "12px 32px",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
  border: "none",
  cursor: "pointer",
};

const dividerStyle = {
  borderColor: "#e5e5e5",
  margin: "32px 0",
  borderWidth: "1px",
  borderStyle: "solid",
  borderTop: "none",
  borderLeft: "none",
  borderRight: "none",
};

const secondaryTextStyle = {
  fontSize: "14px",
  lineHeight: "1.5",
  color: "#6b6b6b",
  margin: "0 0 8px 0",
};

const linkStyle = {
  fontSize: "14px",
  color: "#2563eb",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};

const footerStyle = {
  marginTop: "24px",
  textAlign: "center" as const,
};

const footerTextStyle = {
  fontSize: "12px",
  color: "#9b9b9b",
  margin: 0,
};