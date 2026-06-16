import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { QueryResult } from '../../common/types/database.types';

export interface Payment {
  id: string;
  user_id: string;
  certificate_id: string;
  payment_type: 'self_disclosure' | 'assured';
  amount: number;
  currency: string;
  status:
    | 'pending'
    | 'completed'
    | 'failed'
    | 'refunded'
    | 'disputed'
    | 'partially_refunded';
  is_paid: boolean;
  transaction_id: string | null;
  payment_method: string | null;
  paid_at: Date | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentWithDetails extends Payment {
  certificate_name?: string;
  user_email?: string;
}

export interface PaymentMethod {
  id: string;
  organization_id: string;
  stripe_payment_method_id: string;
  stripe_customer_id: string | null;
  type: string;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  is_default: boolean;
  billing_details: Record<string, any> | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PaymentRepository {
  constructor(private readonly db: DatabaseService) {}

  async createPayment(data: {
    user_id: string;
    certificate_id: string;
    payment_type: 'self_disclosure' | 'assured';
    amount: number;
    currency?: string;
  }): Promise<Payment> {
    const result = (await this.db.query(
      `INSERT INTO payments (user_id, certificate_id, payment_type, amount, currency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.user_id,
        data.certificate_id,
        data.payment_type,
        data.amount,
        data.currency || 'USD',
      ],
    )) as QueryResult<Payment>;
    return result.rows[0];
  }

  async findPaymentById(id: string): Promise<Payment | null> {
    const result = (await this.db.query(
      `SELECT * FROM payments WHERE id = $1`,
      [id],
    )) as QueryResult<Payment>;
    return result.rows[0] || null;
  }

  async findPaymentWithDetails(id: string): Promise<PaymentWithDetails | null> {
    const result = (await this.db.query(
      `SELECT p.*,
              c.name as certificate_name,
              u.email as user_email
       FROM payments p
       LEFT JOIN certificates c ON c.id = p.certificate_id
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [id],
    )) as QueryResult<PaymentWithDetails>;
    return result.rows[0] || null;
  }

  async confirmPayment(
    id: string,
    transactionId: string,
    paymentMethod?: string,
  ): Promise<Payment> {
    const result = (await this.db.query(
      `UPDATE payments
       SET status = 'completed',
           is_paid = TRUE,
           transaction_id = $2,
           payment_method = $3,
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, transactionId, paymentMethod || null],
    )) as QueryResult<Payment>;
    return result.rows[0];
  }

  async failPayment(id: string, reason?: string): Promise<Payment> {
    const result = (await this.db.query(
      `UPDATE payments
       SET status = 'failed',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    )) as QueryResult<Payment>;
    return result.rows[0];
  }

  async findUserPayments(
    userId: string,
    params: { page: number; limit: number },
  ): Promise<{
    data: PaymentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (params.page - 1) * params.limit;

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total FROM payments WHERE user_id = $1`,
      [userId],
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    const result = (await this.db.query(
      `SELECT p.*,
              c.name as certificate_name
       FROM payments p
       LEFT JOIN certificates c ON c.id = p.certificate_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, params.limit, offset],
    )) as QueryResult<PaymentWithDetails>;

    return {
      data: result.rows,
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findPendingPaymentForCertificate(
    userId: string,
    certificateId: string,
    paymentType: string,
  ): Promise<Payment | null> {
    const result = (await this.db.query(
      `SELECT * FROM payments
       WHERE user_id = $1
         AND certificate_id = $2
         AND payment_type = $3
         AND status = 'pending'
       LIMIT 1`,
      [userId, certificateId, paymentType],
    )) as QueryResult<Payment>;
    return result.rows[0] || null;
  }

  async findCompletedPaymentForAssessment(
    userId: string,
    certificateId: string,
    paymentType: string,
  ): Promise<Payment | null> {
    const result = (await this.db.query(
      `SELECT * FROM payments
       WHERE user_id = $1
         AND certificate_id = $2
         AND payment_type = $3
         AND is_paid = TRUE
         AND status = 'completed'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, certificateId, paymentType],
    )) as QueryResult<Payment>;
    return result.rows[0] || null;
  }

  /**
   * Find payment by Stripe Payment Intent ID
   * Used for webhook processing and payment verification
   */
  async findPaymentByStripePaymentIntentId(
    stripePaymentIntentId: string,
  ): Promise<Payment | null> {
    const result = (await this.db.query(
      `SELECT * FROM payments WHERE stripe_payment_intent_id = $1`,
      [stripePaymentIntentId],
    )) as QueryResult<Payment>;
    return result.rows[0] || null;
  }

  /**
   * Find payment by transaction ID (Stripe charge ID)
   * Used for refund webhook processing
   */
  async findPaymentByTransactionId(
    transactionId: string,
  ): Promise<Payment | null> {
    const result = (await this.db.query(
      `SELECT * FROM payments WHERE transaction_id = $1`,
      [transactionId],
    )) as QueryResult<Payment>;
    return result.rows[0] || null;
  }

  /**
   * Update payment with Stripe-specific data
   * Called after creating a payment intent
   */
  async updatePaymentWithStripeIntent(
    id: string,
    stripePaymentIntentId: string,
    stripeCustomerId?: string,
  ): Promise<Payment> {
    const result = (await this.db.query(
      `UPDATE payments
       SET stripe_payment_intent_id = $2,
           stripe_customer_id = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, stripePaymentIntentId, stripeCustomerId || null],
    )) as QueryResult<Payment>;
    return result.rows[0];
  }

  /**
   * Generic method to update payment status
   * Used primarily by webhook handlers
   */
  async updatePaymentStatus(
    id: string,
    updates: Partial<{
      status: string;
      is_paid: boolean;
      transaction_id: string;
      payment_method: string | null;
      paid_at: Date;
      amount: number;
    }>,
  ): Promise<Payment> {
    const setClause: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.status !== undefined) {
      setClause.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }
    if (updates.is_paid !== undefined) {
      setClause.push(`is_paid = $${paramIndex++}`);
      params.push(updates.is_paid);
    }
    if (updates.transaction_id !== undefined) {
      setClause.push(`transaction_id = $${paramIndex++}`);
      params.push(updates.transaction_id);
    }
    if (updates.payment_method !== undefined) {
      setClause.push(`payment_method = $${paramIndex++}`);
      params.push(updates.payment_method);
    }
    if (updates.paid_at !== undefined) {
      setClause.push(`paid_at = $${paramIndex++}`);
      params.push(updates.paid_at);
    }
    if (updates.amount !== undefined) {
      setClause.push(`amount = $${paramIndex++}`);
      params.push(updates.amount);
    }

    setClause.push('updated_at = NOW()');

    const query = `UPDATE payments SET ${setClause.join(', ')} WHERE id = $1 RETURNING *`;

    const result = (await this.db.query(query, params)) as QueryResult<Payment>;
    return result.rows[0];
  }

  /**
   * Find all payment methods for an organization
   */
  async findPaymentMethodsByOrganizationId(
    organizationId: string,
  ): Promise<PaymentMethod[]> {
    const result = (await this.db.query(
      `SELECT * FROM payment_methods 
       WHERE organization_id = $1 
       ORDER BY is_default DESC, created_at DESC`,
      [organizationId],
    )) as QueryResult<PaymentMethod>;
    return result.rows;
  }

  /**
   * Create a new payment method for an organization
   */
  async createPaymentMethod(data: {
    organization_id: string;
    stripe_payment_method_id: string;
    stripe_customer_id?: string;
    type: string;
    card_brand?: string;
    card_last4?: string;
    card_exp_month?: number;
    card_exp_year?: number;
    is_default?: boolean;
    billing_details?: Record<string, any>;
    metadata?: Record<string, any>;
  }): Promise<PaymentMethod> {
    // If setting as default, unset other defaults for this organization
    if (data.is_default) {
      await this.db.query(
        `UPDATE payment_methods 
         SET is_default = FALSE 
         WHERE organization_id = $1 AND is_default = TRUE`,
        [data.organization_id],
      );
    }

    const result = (await this.db.query(
      `INSERT INTO payment_methods (
        organization_id,
        stripe_payment_method_id,
        stripe_customer_id,
        type,
        card_brand,
        card_last4,
        card_exp_month,
        card_exp_year,
        is_default,
        billing_details,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.organization_id,
        data.stripe_payment_method_id,
        data.stripe_customer_id || null,
        data.type,
        data.card_brand || null,
        data.card_last4 || null,
        data.card_exp_month || null,
        data.card_exp_year || null,
        data.is_default || false,
        data.billing_details ? JSON.stringify(data.billing_details) : null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ],
    )) as QueryResult<PaymentMethod>;
    return result.rows[0];
  }

  /**
   * Find payment method by Stripe payment method ID
   */
  async findPaymentMethodByStripeId(
    stripePaymentMethodId: string,
  ): Promise<PaymentMethod | null> {
    const result = (await this.db.query(
      `SELECT * FROM payment_methods
       WHERE stripe_payment_method_id = $1`,
      [stripePaymentMethodId],
    )) as QueryResult<PaymentMethod>;
    return result.rows[0] || null;
  }

  /**
   * Get the Stripe customer ID used by an organization from its existing payment methods.
   * Returns the most recently used stripe_customer_id for the organization, or null if none exists.
   */
  async findOrganizationStripeCustomerId(
    organizationId: string,
  ): Promise<string | null> {
    const result = (await this.db.query(
      `SELECT stripe_customer_id FROM payment_methods
       WHERE organization_id = $1 AND stripe_customer_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId],
    )) as QueryResult<{ stripe_customer_id: string }>;
    return result.rows[0]?.stripe_customer_id || null;
  }

  async getPaymentMetrics(): Promise<{
    totalRevenue: number;
    monthlyRevenue: number;
    pendingPaymentsCount: number;
    pendingPaymentsAmount: number;
    failedPaymentsCount: number;
    failedPaymentsAmount: number;
  }> {
    const totalRevenueResult = (await this.db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE status = 'completed' AND is_paid = TRUE`,
      [],
    )) as QueryResult<{ total: string }>;
    const totalRevenue = parseFloat(totalRevenueResult.rows[0].total || '0');

    const monthlyRevenueResult = (await this.db.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE status = 'completed' 
         AND is_paid = TRUE
         AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
      [],
    )) as QueryResult<{ total: string }>;
    const monthlyRevenue = parseFloat(
      monthlyRevenueResult.rows[0].total || '0',
    );

    const pendingResult = (await this.db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE status = 'pending'`,
      [],
    )) as QueryResult<{ count: string; total: string }>;
    const pendingPaymentsCount = parseInt(
      pendingResult.rows[0].count || '0',
      10,
    );
    const pendingPaymentsAmount = parseFloat(
      pendingResult.rows[0].total || '0',
    );

    const failedResult = (await this.db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE status = 'failed'`,
      [],
    )) as QueryResult<{ count: string; total: string }>;
    const failedPaymentsCount = parseInt(failedResult.rows[0].count || '0', 10);
    const failedPaymentsAmount = parseFloat(failedResult.rows[0].total || '0');

    return {
      totalRevenue,
      monthlyRevenue,
      pendingPaymentsCount,
      pendingPaymentsAmount,
      failedPaymentsCount,
      failedPaymentsAmount,
    };
  }

  async findAdminPayments(params: {
    page: number;
    limit: number;
    status?: string;
    organizationId?: string;
    startDate?: Date;
    endDate?: Date;
    sortBy?: 'date' | 'amount';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: Array<{
      paymentId: string;
      organizationId: string;
      organizationName: string;
      assessmentOrCertificationType: string;
      certificateProductId: string | null;
      amount: number;
      currency: string;
      status: string;
      paymentMethod: string | null;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (params.page - 1) * params.limit;
    const conditions: string[] = [];
    const queryParams: (string | number | Date)[] = [];
    let paramIndex = 1;

    if (params.status) {
      conditions.push(`p.status = $${paramIndex}`);
      queryParams.push(params.status);
      paramIndex++;
    }

    // Only filter by organizationId if explicitly provided and not empty
    if (
      params.organizationId &&
      typeof params.organizationId === 'string' &&
      params.organizationId.trim()
    ) {
      conditions.push(
        `(ca_org.id = $${paramIndex} OR u_org.id = $${paramIndex} OR emp_org.id = $${paramIndex})`,
      );
      queryParams.push(params.organizationId.trim());
      paramIndex++;
    }

    if (params.startDate) {
      conditions.push(`p.created_at >= $${paramIndex}`);
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params.endDate) {
      conditions.push(`p.created_at <= $${paramIndex}`);
      queryParams.push(params.endDate);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM payments p
      LEFT JOIN certificate_assessments ca ON ca.payment_id = p.id
      LEFT JOIN organization ca_org ON ca_org.id = ca.organization_id
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN organization u_org ON u_org.user_id = u.id
      LEFT JOIN employee emp ON emp.user_id = u.id
      LEFT JOIN organization emp_org ON emp_org.id = emp.organization_id
      ${whereClause}
    `;

    const countResult = (await this.db.query(
      countQuery,
      queryParams,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    const sortBy = params.sortBy || 'date';
    const sortOrder = params.sortOrder || 'desc';
    const sortColumn = sortBy === 'date' ? 'created_at' : 'amount';
    const orderClause = `ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;

    // Resolve organization via a single COALESCE chain using a CTE for user→org mapping
    const dataQuery = `
      WITH user_org AS (
        SELECT u.id AS user_id,
               COALESCE(o_owner.id, emp_org.id) AS org_id,
               COALESCE(o_owner.name, emp_org.name) AS org_name
        FROM users u
        LEFT JOIN organization o_owner ON o_owner.user_id = u.id
        LEFT JOIN employee emp ON emp.user_id = u.id
        LEFT JOIN organization emp_org ON emp_org.id = emp.organization_id
      )
      SELECT
        p.id as payment_id,
        COALESCE(ca_org.id, uo.org_id) as organization_id,
        COALESCE(ca_org.name, uo.org_name) as organization_name,
        c.name as certificate_name,
        c.certificate_id as certificate_product_id,
        p.amount,
        p.currency,
        p.status,
        p.payment_method,
        p.created_at
      FROM payments p
      LEFT JOIN certificate_assessments ca ON ca.payment_id = p.id
      LEFT JOIN organization ca_org ON ca_org.id = ca.organization_id
      LEFT JOIN user_org uo ON uo.user_id = p.user_id
      LEFT JOIN certificates c ON c.id = p.certificate_id
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(params.limit, offset);

    const dataResult = (await this.db.query(
      dataQuery,
      queryParams,
    )) as QueryResult<{
      payment_id: string;
      organization_id: string;
      organization_name: string;
      certificate_name: string;
      certificate_product_id: string | null;
      amount: number;
      currency: string;
      status: string;
      payment_method: string | null;
      created_at: Date;
    }>;

    return {
      data: dataResult.rows.map((row) => ({
        paymentId: row.payment_id,
        organizationId: row.organization_id || '',
        organizationName: row.organization_name || 'Unknown Organization',
        assessmentOrCertificationType:
          row.certificate_name || 'Unknown Certificate',
        certificateProductId: row.certificate_product_id || null,
        amount: parseFloat(row.amount.toString()),
        currency: row.currency,
        status: row.status,
        paymentMethod: row.payment_method,
        createdAt: row.created_at,
      })),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findAdminPaymentDetails(paymentId: string): Promise<{
    paymentId: string;
    transactionId: string | null;
    organizationId: string;
    organizationName: string;
    certificateId: string;
    certificateName: string;
    paymentType: string;
    assessmentOrCertificationType: string;
    amount: number;
    currency: string;
    status: string;
    paymentMethod: string | null;
    stripePaymentIntentId: string | null;
    stripeCustomerId: string | null;
    failureReason: string | null;
    createdAt: Date;
    paidAt: Date | null;
    updatedAt: Date;
  } | null> {
    const result = (await this.db.query(
      `SELECT 
        p.id as payment_id,
        p.transaction_id,
        COALESCE(ca_org.id, u_org.id, emp_org.id) as organization_id,
        COALESCE(ca_org.name, u_org.name, emp_org.name) as organization_name,
        p.certificate_id,
        c.name as certificate_name,
        p.payment_type,
        p.amount,
        p.currency,
        p.status,
        p.payment_method,
        p.stripe_payment_intent_id,
        p.stripe_customer_id,
        p.created_at,
        p.paid_at,
        p.updated_at
      FROM payments p
      LEFT JOIN certificate_assessments ca ON ca.payment_id = p.id
      LEFT JOIN organization ca_org ON ca_org.id = ca.organization_id
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN organization u_org ON u_org.user_id = u.id
      LEFT JOIN employee emp ON emp.user_id = u.id
      LEFT JOIN organization emp_org ON emp_org.id = emp.organization_id
      LEFT JOIN certificates c ON c.id = p.certificate_id
      WHERE p.id = $1
      LIMIT 1`,
      [paymentId],
    )) as QueryResult<{
      payment_id: string;
      transaction_id: string | null;
      organization_id: string;
      organization_name: string;
      certificate_id: string;
      certificate_name: string;
      payment_type: string;
      amount: number;
      currency: string;
      status: string;
      payment_method: string | null;
      stripe_payment_intent_id: string | null;
      stripe_customer_id: string | null;
      created_at: Date;
      paid_at: Date | null;
      updated_at: Date;
    }>;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const paymentTypeDisplay =
      row.payment_type === 'self_disclosure' ? 'Self Disclosure' : 'Assured';
    const assessmentOrCertificationType = `${row.certificate_name || 'Unknown'} - ${paymentTypeDisplay}`;

    return {
      paymentId: row.payment_id,
      transactionId: row.transaction_id,
      organizationId: row.organization_id || '',
      organizationName: row.organization_name || 'Unknown Organization',
      certificateId: row.certificate_id,
      certificateName: row.certificate_name || 'Unknown Certificate',
      paymentType: row.payment_type,
      assessmentOrCertificationType,
      amount: parseFloat(row.amount.toString()),
      currency: row.currency,
      status: row.status,
      paymentMethod: row.payment_method,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      stripeCustomerId: row.stripe_customer_id,
      failureReason:
        row.status === 'failed' ? 'Payment processing failed' : null,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      updatedAt: row.updated_at,
    };
  }
}
