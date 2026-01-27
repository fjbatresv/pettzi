import { Route } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { PetCreateStep1Component } from './pages/pet-create-step1/pet-create-step1.component';
import { PetCreateStep2Component } from './pages/pet-create-step2/pet-create-step2.component';
import { DashboardPetComponent } from './pages/dashboard-pet/dashboard-pet.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { DashboardLayoutComponent } from './components/dashboard-layout/dashboard-layout.component';
import { GroomingComponent } from './pages/grooming/grooming.component';
import { VetVisitComponent } from './pages/vet-visit/vet-visit.component';
import { MedicationComponent } from './pages/medication/medication.component';
import { VaccineComponent } from './pages/vaccine/vaccine.component';
import { WeightComponent } from './pages/weight/weight.component';
import { PetEditComponent } from './pages/pet-edit/pet-edit.component';
import { PetShareComponent } from './pages/pet-share/pet-share.component';
import { PetShareRecordsComponent } from './pages/pet-share-records/pet-share-records.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { EmailConfirmComponent } from './pages/email-confirm/email-confirm.component';
import { AccountDeletedComponent } from './pages/account-deleted/account-deleted.component';
import { PetInviteConfirmComponent } from './pages/pet-invite-confirm/pet-invite-confirm.component';
import { PetRecordComponent } from './pages/pet-record/pet-record.component';
import { EventDetailComponent } from './pages/event-detail/event-detail.component';
import { PetInvitesComponent } from './pages/pet-invites/pet-invites.component';
import { authenticatedGuard } from './core/guards/authenticated.guard';
import { unauthenticatedGuard } from './core/guards/unauthenticated.guard';
import { resetPasswordGuard } from './core/guards/reset-password.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [unauthenticatedGuard],
  },
  {
    path: 'register',
    component: SignupComponent,
    canActivate: [unauthenticatedGuard],
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    canActivate: [unauthenticatedGuard],
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    canActivate: [resetPasswordGuard],
  },
  {
    path: 'email-confirm',
    component: EmailConfirmComponent,
  },
  {
    path: 'accept-invite',
    component: PetInviteConfirmComponent,
  },
  {
    path: 'pet-record',
    component: PetRecordComponent,
  },
  {
    path: 'account-deleted',
    component: AccountDeletedComponent,
    canActivate: [unauthenticatedGuard],
  },
  {
    path: '',
    component: DashboardLayoutComponent,
    canActivate: [authenticatedGuard],
    children: [
      {
        path: 'home',
        component: DashboardComponent,
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
        path: 'pets/:petId/event/:eventId',
        component: EventDetailComponent,
      },
      {
        path: 'pets/:petId',
        component: DashboardPetComponent,
      },
      {
        path: 'pets/:petId/edit',
        component: PetEditComponent,
      },
      {
        path: 'pets/:petId/share',
        component: PetShareComponent,
      },
      {
        path: 'pets/:petId/share-records',
        component: PetShareRecordsComponent,
      },
      {
        path: 'pets/:petId/grooming/new',
        component: GroomingComponent,
      },
      {
        path: 'pets/:petId/vet-visits/new',
        component: VetVisitComponent,
      },
      {
        path: 'pets/:petId/medicines/new',
        component: MedicationComponent,
      },
      {
        path: 'pets/:petId/weights/new',
        component: WeightComponent,
      },
      {
        path: 'pets/:petId/vaccines/new',
        component: VaccineComponent,
      },
      {
        path: 'settings',
        component: SettingsComponent,
      },
      {
        path: 'invites',
        component: PetInvitesComponent,
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
