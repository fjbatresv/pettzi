import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import { Construct } from 'constructs';

export interface SesTemplatesStackProps extends StackProps {
  fromEmail: string;
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

    new ses.CfnTemplate(this, 'WelcomeTemplate', {
      template: {
        templateName: SesTemplatesStack.WELCOME_TEMPLATE,
        subjectPart: 'Bienvenido a PETTZI, {{userName}}',
        htmlPart:
          '<h1>Bienvenido a PETTZI</h1><p>Hola {{userName}}, gracias por unirte a PETTZI.</p>',
        textPart: 'Hola {{userName}}, gracias por unirte a PETTZI.',
      },
    });

    new ses.CfnTemplate(this, 'ResetTemplate', {
      template: {
        templateName: SesTemplatesStack.RESET_TEMPLATE,
        subjectPart: 'Restablece tu contraseña en PETTZI',
        htmlPart:
          '<p>Hemos recibido una solicitud de restablecimiento de contraseña.</p><p>Si fuiste tú, completa el proceso desde tu bandeja o sigue el enlace: {{resetLink}}</p>',
        textPart:
          'Solicitud de restablecimiento de contraseña. Completa el proceso desde tu bandeja o utiliza: {{resetLink}}',
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
