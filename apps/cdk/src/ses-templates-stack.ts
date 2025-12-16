import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface SesTemplatesStackProps extends StackProps {
  fromEmail: string;
  hostedZoneName?: string;
  hostedZoneId?: string;
}

export class SesTemplatesStack extends Stack {
  public static readonly WELCOME_TEMPLATE = 'PettziWelcomeEmail';
  public static readonly RESET_TEMPLATE = 'PettziPasswordResetEmail';
  public static readonly REMINDER_TEMPLATE = 'PettziReminderNotificationEmail';
  public static readonly EVENT_TEMPLATE = 'PettziEventNotificationEmail';

  constructor(scope: Construct, id: string, props: SesTemplatesStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

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

    new ses.CfnTemplate(this, 'WelcomeTemplate', {
      template: {
        templateName: SesTemplatesStack.WELCOME_TEMPLATE,
        subjectPart: 'Bienvenido a PETTZI, {{userName}}',
        htmlPart:
          '<h1>Bienvenido a PETTZI</h1><p>Hola {{userName}}, gracias por unirte a PETTZI.</p>' +
          '<p>Confirma tu correo haciendo clic aquí: <a href="{{verificationLink}}">{{verificationLink}}</a></p>',
        textPart:
          'Hola {{userName}}, gracias por unirte a PETTZI. Confirma tu correo aquí: {{verificationLink}}',
      },
    });

    new ses.CfnTemplate(this, 'ResetTemplate', {
      template: {
        templateName: SesTemplatesStack.RESET_TEMPLATE,
        subjectPart: 'Restablece tu contraseña en PETTZI',
        htmlPart:
          '<p>Hemos generado una contraseña temporal para ti: {{temporaryPassword}}</p>' +
          '<p>Úsala para iniciar sesión y luego cambia tu contraseña en el panel.</p>',
        textPart:
          'Tu contraseña temporal es {{temporaryPassword}}. Inicia sesión y actualízala.',
      },
    });

    new ses.CfnTemplate(this, 'ReminderTemplate', {
      template: {
        templateName: SesTemplatesStack.REMINDER_TEMPLATE,
        subjectPart: 'Recordatorio PETTZI: {{eventType}} para {{petName}}',
        htmlPart:
          '<p>Hola,</p><p>Tienes un recordatorio de {{eventType}} para {{petName}} el {{eventDate}}.</p><p>Detalle: {{notes}}</p>',
        textPart:
          'Tienes un recordatorio de {{eventType}} para {{petName}} el {{eventDate}}. Detalle: {{notes}}',
      },
    });

    new ses.CfnTemplate(this, 'EventTemplate', {
      template: {
        templateName: SesTemplatesStack.EVENT_TEMPLATE,
        subjectPart: 'Evento PETTZI: {{eventType}} para {{petName}}',
        htmlPart:
          '<p>Evento registrado: {{eventType}} para {{petName}} el {{eventDate}}.</p><p>Notas: {{notes}}</p>',
        textPart:
          'Evento registrado: {{eventType}} para {{petName}} el {{eventDate}}. Notas: {{notes}}',
      },
    });
  }
}
