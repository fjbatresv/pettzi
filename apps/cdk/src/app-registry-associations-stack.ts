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

    props.stacks.forEach((stack, index) => {
      // Enforce deployment order
      this.addDependency(stack);

      new appreg.CfnResourceAssociation(this, `AppAssoc${index}`, {
        application: props.applicationArn,
        resource: stack.stackId,
        resourceType: 'CFN_STACK',
      });
    });
  }
}
