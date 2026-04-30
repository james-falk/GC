CREATE TYPE "public"."user_role" AS ENUM('principal', 'finance', 'pm', 'assistant', 'sub_user', 'architect', 'owner');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('owner', 'architect');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'on_hold', 'closed');--> statement-breakpoint
CREATE TYPE "public"."subcontract_status" AS ENUM('draft', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."change_order_status" AS ENUM('draft', 'pending_principal', 'pending_architect', 'architect_rejected', 'pending_owner', 'owner_rejected', 'approved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pay_app_direction" AS ENUM('sub_to_gc', 'gc_to_owner');--> statement-breakpoint
CREATE TYPE "public"."pay_app_status" AS ENUM('draft', 'cancelled', 'paid', 'submitted', 'needs_revision', 'approved_by_pm', 'approved_by_principal', 'approved', 'included_in_owner_pay_app', 'generated', 'signed', 'notarized', 'sent_to_architect', 'architect_rejected', 'architect_approved', 'sent_to_owner', 'owner_rejected', 'owner_approved');--> statement-breakpoint
CREATE TYPE "public"."sworn_statement_status" AS ENUM('generated', 'signed', 'notarized', 'sent_to_architect', 'architect_approved', 'sent_to_owner', 'owner_approved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."approval_actor_type" AS ENUM('internal_user', 'external_invitee', 'system');--> statement-breakpoint
CREATE TYPE "public"."magic_link_action" AS ENUM('review_only', 'approve_or_reject');--> statement-breakpoint
CREATE TYPE "public"."magic_link_recipient_role" AS ENUM('architect', 'owner', 'sub_user');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_tenant_email_unique" UNIQUE("tenant_id","email")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "organization_type" NOT NULL,
	"address" text,
	"contact_email" text,
	"contact_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcontractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_number" text NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid,
	"architect_id" uuid,
	"original_contract_amount" numeric(14, 2) NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"start_date" date,
	"target_completion_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcontracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"subcontractor_id" uuid NOT NULL,
	"contract_number" text NOT NULL,
	"original_amount" numeric(14, 2) NOT NULL,
	"current_amount" numeric(14, 2) NOT NULL,
	"spec_sections" text[],
	"inclusions" text,
	"exclusions" text,
	"status" "subcontract_status" DEFAULT 'draft' NOT NULL,
	"signed_contract_attachment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sov_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_line_id" uuid,
	"line_number" text NOT NULL,
	"description" text NOT NULL,
	"subcontract_id" uuid,
	"contract_amount" numeric(14, 2) NOT NULL,
	"current_amount" numeric(14, 2) NOT NULL,
	"stored_materials_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"co_number" text NOT NULL,
	"description" text NOT NULL,
	"justification" text,
	"affected_subcontract_id" uuid,
	"total_amount" numeric(14, 2) NOT NULL,
	"status" "change_order_status" DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_order_id" uuid NOT NULL,
	"sov_line_id" uuid NOT NULL,
	"delta_amount" numeric(14, 2) NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "pay_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"direction" "pay_app_direction" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"subcontract_id" uuid,
	"status" "pay_app_status" DEFAULT 'draft' NOT NULL,
	"total_billed" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_retention" numeric(14, 2) DEFAULT '0' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_application_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pay_application_id" uuid NOT NULL,
	"sov_line_id" uuid NOT NULL,
	"previously_billed_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sub_reported_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gc_adjusted_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"this_period_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"stored_materials_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"retention_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gc_note" text
);
--> statement-breakpoint
CREATE TABLE "sworn_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pay_application_id" uuid NOT NULL,
	"generated_pdf_attachment_id" uuid NOT NULL,
	"signed_pdf_attachment_id" uuid,
	"notarized_pdf_attachment_id" uuid,
	"status" "sworn_statement_status" DEFAULT 'generated' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_type" "approval_actor_type" NOT NULL,
	"actor_user_id" uuid,
	"actor_external_email" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"target_entity_type" text NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_role" "magic_link_recipient_role" NOT NULL,
	"token_hash" text NOT NULL,
	"action" "magic_link_action" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractors" ADD CONSTRAINT "subcontractors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_organizations_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_architect_id_organizations_id_fk" FOREIGN KEY ("architect_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontracts" ADD CONSTRAINT "subcontracts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontracts" ADD CONSTRAINT "subcontracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontracts" ADD CONSTRAINT "subcontracts_subcontractor_id_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "public"."subcontractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontracts" ADD CONSTRAINT "subcontracts_signed_contract_attachment_id_document_attachments_id_fk" FOREIGN KEY ("signed_contract_attachment_id") REFERENCES "public"."document_attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sov_lines" ADD CONSTRAINT "sov_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sov_lines" ADD CONSTRAINT "sov_lines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sov_lines" ADD CONSTRAINT "sov_lines_parent_line_id_sov_lines_id_fk" FOREIGN KEY ("parent_line_id") REFERENCES "public"."sov_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sov_lines" ADD CONSTRAINT "sov_lines_subcontract_id_subcontracts_id_fk" FOREIGN KEY ("subcontract_id") REFERENCES "public"."subcontracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_affected_subcontract_id_subcontracts_id_fk" FOREIGN KEY ("affected_subcontract_id") REFERENCES "public"."subcontracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_order_lines" ADD CONSTRAINT "change_order_lines_change_order_id_change_orders_id_fk" FOREIGN KEY ("change_order_id") REFERENCES "public"."change_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_order_lines" ADD CONSTRAINT "change_order_lines_sov_line_id_sov_lines_id_fk" FOREIGN KEY ("sov_line_id") REFERENCES "public"."sov_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_applications" ADD CONSTRAINT "pay_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_applications" ADD CONSTRAINT "pay_applications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_applications" ADD CONSTRAINT "pay_applications_subcontract_id_subcontracts_id_fk" FOREIGN KEY ("subcontract_id") REFERENCES "public"."subcontracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_application_lines" ADD CONSTRAINT "pay_application_lines_pay_application_id_pay_applications_id_fk" FOREIGN KEY ("pay_application_id") REFERENCES "public"."pay_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_application_lines" ADD CONSTRAINT "pay_application_lines_sov_line_id_sov_lines_id_fk" FOREIGN KEY ("sov_line_id") REFERENCES "public"."sov_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sworn_statements" ADD CONSTRAINT "sworn_statements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sworn_statements" ADD CONSTRAINT "sworn_statements_pay_application_id_pay_applications_id_fk" FOREIGN KEY ("pay_application_id") REFERENCES "public"."pay_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sworn_statements" ADD CONSTRAINT "sworn_statements_generated_pdf_attachment_id_document_attachments_id_fk" FOREIGN KEY ("generated_pdf_attachment_id") REFERENCES "public"."document_attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sworn_statements" ADD CONSTRAINT "sworn_statements_signed_pdf_attachment_id_document_attachments_id_fk" FOREIGN KEY ("signed_pdf_attachment_id") REFERENCES "public"."document_attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sworn_statements" ADD CONSTRAINT "sworn_statements_notarized_pdf_attachment_id_document_attachments_id_fk" FOREIGN KEY ("notarized_pdf_attachment_id") REFERENCES "public"."document_attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;