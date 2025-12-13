import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appreg from 'aws-cdk-lib/aws-servicecatalogappregistry';

export interface PettziApplicationStackProps extends cdk.StackProps {
  applicationName: string;
  applicationDescription?: string;
}

export class PettziApplicationStack extends cdk.Stack {
  public readonly applicationArn: string;

  constructor(scope: Construct, id: string, props: PettziApplicationStackProps) {
    super(scope, id, props);

    const application = new appreg.CfnApplication(this, 'PettziAppRegistryApplication', {
      name: props.applicationName,
      description: props.applicationDescription ?? 'PETTZI platform (frontend + backend)',
      tags: {
        Application: props.applicationName,
        Domain: 'Pettzi',
        awsApplication: props.applicationName,
      },
    });

    const attributes = new appreg.CfnAttributeGroup(this, 'PettziAttributes', {
      name: 'PettziApplicationAttributes',
      description: 'Metadata for the PETTZI application (FE + BE)',
      attributes: {
        domain: 'Pet Management / Health',
        owner: 'Javier Batres',
        repo: 'https://github.com/fjbatresv/pettzi',
        frontend: {
          framework: 'Angular',
          project: 'apps/web',
        },
        backend: {
          language: 'TypeScript',
          runtime: 'Node.js 24.x',
          infra: 'AWS CDK v2',
          services: [
            'Lambda',
            'DynamoDB',
            'API Gateway HTTP APIs',
            'Cognito',
            'S3',
            'SES',
            'EventBridge',
          ],
        },
        monorepo: {
          tool: 'Nx',
        },
      },
      tags: {
        Application: props.applicationName,
        Domain: 'Pettzi',
      },
    });

    new appreg.CfnAttributeGroupAssociation(this, 'AppAttributeAssociation', {
      application: application.attrArn,
      attributeGroup: attributes.attrArn,
    });

    this.applicationArn = application.attrArn;

    console.log('Application ARN', this.applicationArn)

    new cdk.CfnOutput(this, 'PettziAppRegistryApplicationArn', {
      value: this.applicationArn,
    });
  }
}
