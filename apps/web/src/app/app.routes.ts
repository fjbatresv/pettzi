import { Route } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { PetCreateStep1Component } from './pages/pet-create-step1/pet-create-step1.component';
import { PetCreateStep2Component } from './pages/pet-create-step2/pet-create-step2.component';
import { DashboardMainComponent } from './pages/dashboard-main/dashboard-main.component';
import { DashboardPetComponent } from './pages/dashboard-pet/dashboard-pet.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { DashboardLayoutComponent } from './components/dashboard-layout/dashboard-layout.component';
import { GroomingComponent } from './pages/grooming/grooming.component';

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
  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        component: DashboardComponent,
      },
      {
        path: 'main',
        component: DashboardMainComponent,
      },
      {
        path: 'pet',
        component: DashboardPetComponent,
      },
      {
        path: 'grooming',
        component: GroomingComponent,
      },
    ],
  },
];
