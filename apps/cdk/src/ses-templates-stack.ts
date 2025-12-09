import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import { Construct } from 'constructs';

export interface SesTemplatesStackProps extends StackProps {
  fromEmail: string;
}

export class SesTemplatesStack extends Stack {
  public static readonly WELCOME_TEMPLATE = 'PetoWelcomeEmail';
  public static readonly RESET_TEMPLATE = 'PetoPasswordResetEmail';
  public static readonly REMINDER_TEMPLATE = 'PetoReminderNotificationEmail';
  public static readonly EVENT_TEMPLATE = 'PetoEventNotificationEmail';

  constructor(scope: Construct, id: string, props: SesTemplatesStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'peto');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    new ses.CfnTemplate(this, 'WelcomeTemplate', {
      template: {
        templateName: SesTemplatesStack.WELCOME_TEMPLATE,
        subjectPart: 'Bienvenido a PETO, {{userName}}',
        htmlPart:
          '<h1>Bienvenido a PETO</h1><p>Hola {{userName}}, gracias por unirte a PETO.</p>',
        textPart: 'Hola {{userName}}, gracias por unirte a PETO.',
      },
    });

    new ses.CfnTemplate(this, 'ResetTemplate', {
      template: {
        templateName: SesTemplatesStack.RESET_TEMPLATE,
        subjectPart: 'Restablece tu contraseña en PETO',
        htmlPart:
          '<p>Hemos recibido una solicitud de restablecimiento de contraseña.</p><p>Si fuiste tú, completa el proceso desde tu bandeja o sigue el enlace: {{resetLink}}</p>',
        textPart:
          'Solicitud de restablecimiento de contraseña. Completa el proceso desde tu bandeja o utiliza: {{resetLink}}',
      },
    });

    new ses.CfnTemplate(this, 'ReminderTemplate', {
      template: {
        templateName: SesTemplatesStack.REMINDER_TEMPLATE,
        subjectPart: 'Recordatorio PETO: {{eventType}} para {{petName}}',
        htmlPart:
          '<p>Hola,</p><p>Tienes un recordatorio de {{eventType}} para {{petName}} el {{eventDate}}.</p><p>Detalle: {{notes}}</p>',
        textPart:
          'Tienes un recordatorio de {{eventType}} para {{petName}} el {{eventDate}}. Detalle: {{notes}}',
      },
    });

    new ses.CfnTemplate(this, 'EventTemplate', {
      template: {
        templateName: SesTemplatesStack.EVENT_TEMPLATE,
        subjectPart: 'Evento PETO: {{eventType}} para {{petName}}',
        htmlPart:
          '<p>Evento registrado: {{eventType}} para {{petName}} el {{eventDate}}.</p><p>Notas: {{notes}}</p>',
        textPart:
          'Evento registrado: {{eventType}} para {{petName}} el {{eventDate}}. Notas: {{notes}}',
      },
    });
  }
}
