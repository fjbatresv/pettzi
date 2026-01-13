import { Route } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { PetCreateStep1Component } from './pages/pet-create-step1/pet-create-step1.component';
import { PetCreateStep2Component } from './pages/pet-create-step2/pet-create-step2.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: LoginComponent,
  },
  {
    path: 'signup',
    component: SignupComponent,
  },
  {
    path: 'pets/new',
    component: PetCreateStep1Component,
  },
  {
    path: 'pets/new/details',
    component: PetCreateStep2Component,
  },
];
