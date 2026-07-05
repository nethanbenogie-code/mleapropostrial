/**
 * MLEA POS — Firebase Cloud Functions
 * Deploy: firebase deploy --only functions
 *
 * Functions:
 *  1. getNextORNumber  — atomic server-side OR counter (no duplicates)
 *  2. onSaleCreate     — update daily/monthly aggregates
 *  3. onSaleVoid       — adjust aggregates on void
 *  4. scheduledBackup  — daily Firestore export to Cloud Storage
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// ── 1. Atomic OR Number Generator ────────────────────────────────────────────
// Solves the multi-device offline duplicate OR problem.
// All devices call this function to get the next OR number — never local.
exports.getNextORNumber = functions
  .region('asia-east1') // nearest to PH
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

    const prefix = data.prefix || 'OR';
    const counterRef = db.doc('orCounter/sequence');

    const newNumber = await db.runTransaction(async tx => {
      const doc = await tx.get(counterRef);
      const current = doc.exists ? (doc.data().counter || 0) : 0;
      const next = current + 1;
      tx.set(counterRef, { counter: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return next;
    });

    const orNumber = `${prefix}-${String(newNumber).padStart(7, '0')}`;

    // Warn if approaching series end
    const seriesTo = parseInt(data.seriesTo) || 9999999;
    const remaining = seriesTo - newNumber;

    return {
      orNumber,
      counter: newNumber,
      remaining,
      nearingEnd: remaining <= 100,
    };
  });

// ── 2. On Sale Create — update aggregates ────────────────────────────────────
exports.onSaleCreate = functions
  .region('asia-east1')
  .firestore.document('sales/{saleId}')
  .onCreate(async (snap, context) => {
    const sale = snap.data();
    if (!sale || sale.voided) return;

    const date = sale.date || new Date().toISOString().split('T')[0];
    const month = date.substring(0, 7);
    const branchId = sale.branchId || 'global';

    const batch = db.batch();

    // Daily aggregate
    const dayRef = db.doc(`aggregates/daily_${date}_${branchId}`);
    batch.set(dayRef, {
      date, branchId, month,
      total: admin.firestore.FieldValue.increment(sale.total || 0),
      tax: admin.firestore.FieldValue.increment(sale.tax || 0),
      vatableSales: admin.firestore.FieldValue.increment(sale.vatableSales || 0),
      count: admin.firestore.FieldValue.increment(1),
      scDiscounts: admin.firestore.FieldValue.increment(sale.discountType === 'sc' ? sale.discountAmount || 0 : 0),
      pwdDiscounts: admin.firestore.FieldValue.increment(sale.discountType === 'pwd' ? sale.discountAmount || 0 : 0),
    }, { merge: true });

    // Monthly aggregate
    const monthRef = db.doc(`aggregates/monthly_${month}_${branchId}`);
    batch.set(monthRef, {
      month, branchId,
      total: admin.firestore.FieldValue.increment(sale.total || 0),
      tax: admin.firestore.FieldValue.increment(sale.tax || 0),
      vatableSales: admin.firestore.FieldValue.increment(sale.vatableSales || 0),
      count: admin.firestore.FieldValue.increment(1),
      scDiscounts: admin.firestore.FieldValue.increment(sale.discountType === 'sc' ? sale.discountAmount || 0 : 0),
      pwdDiscounts: admin.firestore.FieldValue.increment(sale.discountType === 'pwd' ? sale.discountAmount || 0 : 0),
    }, { merge: true });

    // Update GAT
    const gatRef = db.doc('settings/bir_gat_doc');
    batch.set(gatRef, {
      key: 'bir_gat',
      value: admin.firestore.FieldValue.increment(sale.total || 0),
    }, { merge: true });

    return batch.commit();
  });

// ── 3. On Sale Void — reverse aggregates ─────────────────────────────────────
exports.onSaleVoid = functions
  .region('asia-east1')
  .firestore.document('sales/{saleId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only process when voided flag changes false → true
    if (!before || !after || before.voided || !after.voided) return;

    const date = after.date;
    const month = date.substring(0, 7);
    const branchId = after.branchId || 'global';
    const batch = db.batch();

    const dayRef = db.doc(`aggregates/daily_${date}_${branchId}`);
    batch.set(dayRef, {
      total: admin.firestore.FieldValue.increment(-(after.total || 0)),
      tax: admin.firestore.FieldValue.increment(-(after.tax || 0)),
      vatableSales: admin.firestore.FieldValue.increment(-(after.vatableSales || 0)),
      voidCount: admin.firestore.FieldValue.increment(1),
    }, { merge: true });

    const monthRef = db.doc(`aggregates/monthly_${month}_${branchId}`);
    batch.set(monthRef, {
      total: admin.firestore.FieldValue.increment(-(after.total || 0)),
      tax: admin.firestore.FieldValue.increment(-(after.tax || 0)),
      vatableSales: admin.firestore.FieldValue.increment(-(after.vatableSales || 0)),
      voidCount: admin.firestore.FieldValue.increment(1),
    }, { merge: true });

    return batch.commit();
  });

// ── 4. Scheduled Daily Backup to Cloud Storage ───────────────────────────────
// Runs at 11:55 PM Manila time every day
exports.scheduledBackup = functions
  .region('asia-east1')
  .pubsub.schedule('55 23 * * *')
  .timeZone('Asia/Manila')
  .onRun(async context => {
    const client = new admin.firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    const databaseName = client.databasePath(projectId, '(default)');
    const bucket = `gs://${projectId}-backups`;
    const timestamp = new Date().toISOString().split('T')[0];

    try {
      await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: `${bucket}/backups/${timestamp}`,
        collectionIds: [], // empty = all collections
      });
      console.log(`Backup completed: ${bucket}/backups/${timestamp}`);
    } catch (err) {
      console.error('Backup failed:', err);
      throw err;
    }
  });
