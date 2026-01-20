import { Stack, StackProps } from 'aws-cdk-lib';
import * as appreg from 'aws-cdk-lib/aws-servicecatalogappregistry';
import { Construct } from 'constructs';

export interface AppRegistryAssociationsStackProps extends StackProps {
  applicationArn: string;
  applicationName: string;
  stacks: Stack[];
}

/**
 * Creates AppRegistry resource associations for existing stacks.
 * This stack depends on the application stack and the target stacks.
 */
export class AppRegistryAssociationsStack extends Stack {
  constructor(scope: Construct, id: string, props: AppRegistryAssociationsStackProps) {
    super(scope, id, props);

    props.stacks.forEach((stack) => {
      // Enforce deployment order
      this.addDependency(stack);

      const safeId = stack.stackName.replace(/[^A-Za-z0-9]/g, '');
      const assocId = safeId ? `AppAssoc${safeId}` : `AppAssoc${stack.node.id}`;

      new appreg.CfnResourceAssociation(this, assocId, {
        application: props.applicationArn,
        resource: stack.stackId,
        resourceType: 'CFN_STACK',
      });
    });
  }
}
