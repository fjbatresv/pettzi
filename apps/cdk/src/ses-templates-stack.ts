import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

export interface SesTemplatesStackProps extends StackProps {
  fromEmail: string;
  hostedZoneName?: string;
  hostedZoneId?: string;
}

export class SesTemplatesStack extends Stack {
  public static readonly WELCOME_TEMPLATE_ES = 'PettziWelcomeEmailEs';
  public static readonly WELCOME_TEMPLATE_EN = 'PettziWelcomeEmailEn';
  public static readonly RESET_TEMPLATE_ES = 'PettziPasswordResetEmailEs';
  public static readonly RESET_TEMPLATE_EN = 'PettziPasswordResetEmailEn';
  public static readonly REMINDER_TEMPLATE_ES = 'PettziReminderNotificationEmailEs';
  public static readonly REMINDER_TEMPLATE_EN = 'PettziReminderNotificationEmailEn';
  public static readonly EVENT_TEMPLATE_ES = 'PettziEventNotificationEmailEs';
  public static readonly EVENT_TEMPLATE_EN = 'PettziEventNotificationEmailEn';

  constructor(scope: Construct, id: string, props: SesTemplatesStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    const resolveTemplatesDir = () => {
      let current = __dirname;
      for (let i = 0; i < 8; i += 1) {
        const candidate = path.resolve(current, 'apps/cdk/src/ses-templates');
        if (fs.existsSync(candidate)) {
          return candidate;
        }
        current = path.resolve(current, '..');
      }
      return path.resolve(process.cwd(), 'apps/cdk/src/ses-templates');
    };

    const templatesDir = resolveTemplatesDir();
    const loadHtml = (fileName: string) =>
      fs.readFileSync(path.resolve(templatesDir, fileName), 'utf8');

    if (props.hostedZoneName) {
      const zone =
        props.hostedZoneId != null
          ? route53.HostedZone.fromHostedZoneAttributes(this, 'SesHostedZone', {
              hostedZoneId: props.hostedZoneId,
              zoneName: props.hostedZoneName,
            })
          : route53.HostedZone.fromLookup(this, 'SesHostedZoneLookup', {
              domainName: props.hostedZoneName,
            });

      new ses.EmailIdentity(this, 'SesDomainIdentity', {
        identity: ses.Identity.publicHostedZone(zone),
        mailFromDomain: `mail.${zone.zoneName}`,
      });
    }

    new ses.CfnTemplate(this, 'WelcomeTemplateEs', {
      template: {
        templateName: SesTemplatesStack.WELCOME_TEMPLATE_ES,
        subjectPart: 'Bienvenido a PETTZI, {{userName}}',
        htmlPart: loadHtml('welcome.es.html'),
        textPart:
          'Hola {{userName}}, gracias por unirte a PETTZI. Confirma tu correo aquí: {{verificationLink}}',
      },
    });

    new ses.CfnTemplate(this, 'WelcomeTemplateEn', {
      template: {
        templateName: SesTemplatesStack.WELCOME_TEMPLATE_EN,
        subjectPart: 'Welcome to PETTZI, {{userName}}',
        htmlPart: loadHtml('welcome.en.html'),
        textPart:
          'Hi {{userName}}, thanks for joining PETTZI. Confirm your email here: {{verificationLink}}',
      },
    });

    new ses.CfnTemplate(this, 'ResetTemplateEs', {
      template: {
        templateName: SesTemplatesStack.RESET_TEMPLATE_ES,
        subjectPart: 'Restablece tu contraseña en PETTZI',
        htmlPart: loadHtml('reset.es.html'),
        textPart:
          'Tu contraseña temporal es {{temporaryPassword}}. Inicia sesión y actualízala.',
      },
    });

    new ses.CfnTemplate(this, 'ResetTemplateEn', {
      template: {
        templateName: SesTemplatesStack.RESET_TEMPLATE_EN,
        subjectPart: 'Reset your PETTZI password',
        htmlPart: loadHtml('reset.en.html'),
        textPart:
          'Your temporary password is {{temporaryPassword}}. Sign in and update it.',
      },
    });

    new ses.CfnTemplate(this, 'ReminderTemplateEs', {
      template: {
        templateName: SesTemplatesStack.REMINDER_TEMPLATE_ES,
        subjectPart: 'Recordatorio PETTZI: {{eventType}} para {{petName}}',
        htmlPart: loadHtml('reminder.es.html'),
        textPart:
          'Tienes un recordatorio de {{eventType}} para {{petName}} el {{eventDate}}. Detalle: {{notes}}',
      },
    });

    new ses.CfnTemplate(this, 'ReminderTemplateEn', {
      template: {
        templateName: SesTemplatesStack.REMINDER_TEMPLATE_EN,
        subjectPart: 'PETTZI Reminder: {{eventType}} for {{petName}}',
        htmlPart: loadHtml('reminder.en.html'),
        textPart:
          'You have a {{eventType}} reminder for {{petName}} on {{eventDate}}. Details: {{notes}}',
      },
    });

    new ses.CfnTemplate(this, 'EventTemplateEs', {
      template: {
        templateName: SesTemplatesStack.EVENT_TEMPLATE_ES,
        subjectPart: 'Evento PETTZI: {{eventType}} para {{petName}}',
        htmlPart: loadHtml('event.es.html'),
        textPart:
          'Evento registrado: {{eventType}} para {{petName}} el {{eventDate}}. Notas: {{notes}}',
      },
    });

    new ses.CfnTemplate(this, 'EventTemplateEn', {
      template: {
        templateName: SesTemplatesStack.EVENT_TEMPLATE_EN,
        subjectPart: 'PETTZI Event: {{eventType}} for {{petName}}',
        htmlPart: loadHtml('event.en.html'),
        textPart:
          'Event logged: {{eventType}} for {{petName}} on {{eventDate}}. Notes: {{notes}}',
      },
    });
  }
}
