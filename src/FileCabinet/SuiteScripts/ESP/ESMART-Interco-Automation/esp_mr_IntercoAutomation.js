/**
 * Scans for invoices that require intercompany transactions and 
 * automates creation of 
 *  - Intercompany Purchase Order
 *  - Intercompany Sales Order
 *  - Vendor Bill for the PO
 *  - Bill/Invoice for the SO
 * 
 * Updates the original invoice with the necessary reference values.
 * 
 * Uses about 140 units per map phase (invoice)
 * 
 * All amounts are assumed to be USD
 * 
 * Client: E-Smart
 *
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 *
 * @author Blaine Horrocks
 */
define(['N/runtime','N/search','N/record'],
(runtime, search, record) => {

    // Environment specific constants that might change in the installation
    const NS_ENV = {
        LOCATIONS: {
            US_LLC: '15' // LLC
        },
        SUBSIDIARIES: {
            US_LLC: '8' // LLC
        },
        PO_TYPES: {
            OP_EXPENSE: '3' // Operations Expense
        }
    };

    const PARAMETERS = {
        MAX_BATCH: {
            ID: 'custscript_itrco_max_batch_size'
        },
        PARENT_SPLIT: {
            ID: 'custscript_itrco_parent_split'
        },
        INTERCO_PURCHASE_VEND: {
            ID: 'custscript_itrco_purchase_vend'
        },
        INTERCO_SALES_CUST: {
            ID: 'custscript_itrco_sales_cust'
        },
        INTERCO_REV_ITEM: {
            ID: 'custscript_itrco_revenue_item'
        }
    };

    /**
     * Loads the script parameters values
     *
     * Requires:
     *     const PARAMETERS = {
     *         A_PARAM: {
     *             ID: 'custscript_id_name',
     *             LEVEL: 'SCRIPT'
     *         }
     *     }
     *
     */
    const getParameters = () => {
        let scriptParamFunc = runtime.getCurrentScript().getParameter;
        let globalParamFunc = runtime.getCurrentUser().getPreference;

     let junk = "something"

        for (var sParameter in PARAMETERS) {
            let oParam = PARAMETERS[sParameter];

            oParam.value = (oParam.LEVEL === 'GLOBAL') ?
                globalParamFunc({ name: oParam.ID }) :
                scriptParamFunc({ name: oParam.ID });

                log.debug({
                  title: sParameter,
                  details: oParam
                });
        }

    }

    /*
     * Utility to make the memo references consistent 
     */
    const getInvoiceReferenceString = (oInvoice) => {
        return 'Interco for ' + oInvoice.getValue({ fieldId: 'tranid'});
    }

    /*
     * Calculate the revenue split.   Used on the PO and the SO
     */
    const getRevenueSplit = (oInvoice) => {
        const SRC_REVENUE = oInvoice.getValue({ fieldId: 'subtotal'});
        return Number(SRC_REVENUE * PARAMETERS.PARENT_SPLIT.value / 100) || 1;
    }

    /**
     * Create an intercompany purchase order for the services
     * that are associated with a recurring invoice.
     *
     * @param {Object} oInvoice - Invoice record
     */
    const createPurchaseOrder = (oInvoice) => {

        let oPurchaseOrder = record.create({
            type: record.Type.PURCHASE_ORDER,
            isDynamic: true,
            defaultValues: {
                entity: PARAMETERS.INTERCO_PURCHASE_VEND.value
            }
        });

        oPurchaseOrder.setValue({
            fieldId: 'memo',
            value: getInvoiceReferenceString(oInvoice)
        });

        oPurchaseOrder.setValue({
            fieldId: 'subsidiary',
            value: NS_ENV.SUBSIDIARIES.US_LLC
        });

        oPurchaseOrder.setValue({
            fieldId: 'location',
            value: NS_ENV.LOCATIONS.US_LLC
        });

        // Only approved POs are eligable for intercompany linkage
        oPurchaseOrder.setValue({
            fieldId: 'approvalstatus',
            value: '2' // Approved
        });

        oPurchaseOrder.setValue({
            fieldId: 'custbody_esp_po_type',
            value: NS_ENV.PO_TYPES.OP_EXPENSE
        });

        oPurchaseOrder.selectNewLine({sublistId: 'item'});
        
        let nRevenueSplit = getRevenueSplit(oInvoice);

        oPurchaseOrder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: PARAMETERS.INTERCO_REV_ITEM.value
        });

        oPurchaseOrder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'rate',
            value: nRevenueSplit
        });

        oPurchaseOrder.commitLine({sublistId: 'item'})

        oPurchaseOrder.save({
            enableSourcing: true,
            ignoreMandatoryFields: true
        });
            
        return oPurchaseOrder;
    }

    /**
     * Create an intercompany purchase order for the services
     * that are associated with a recurring invoice.
     *
     * @param {Object} oInvoice - Invoice record
     */
    const createSalesOrder = (oInvoice, sRelatedPurchaseOrderId) => {

            let oSalesOrder = record.create({
                type: record.Type.SALES_ORDER,
                isDynamic: true,
                defaultValues: {
                    entity: PARAMETERS.INTERCO_SALES_CUST.value
                }
            });

            oSalesOrder.setValue({
                fieldId: 'memo',
                value: getInvoiceReferenceString(oInvoice)
            });

            oSalesOrder.setValue({
                fieldId: 'orderstatus',
                value: 'B' // Pending Fulfillment
            });

            oSalesOrder.setValue({
                fieldId: 'custbody_esp_po_type',
                value: NS_ENV.PO_TYPES.OP_EXPENSE
            });

            // Add the item (singular) list
            oSalesOrder.selectNewLine({sublistId: 'item'});
            
            let nRevenueSplit = getRevenueSplit(oInvoice);

            oSalesOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                value: PARAMETERS.INTERCO_REV_ITEM.value
            });

            oSalesOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                value: nRevenueSplit
            });

            oSalesOrder.commitLine({sublistId: 'item'});

            // Link the SO back to the source PO
            oSalesOrder.setValue({
                fieldId: 'intercotransaction',
                value: sRelatedPurchaseOrderId
            });
            
            oSalesOrder.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            return oSalesOrder;
    }

    /** Error handler 
     * Based on the transactions that have been created we
     * want to disconnect and delete them. 
     * 
     * @param {Array} aTransactions - The stack of created transaction objects
     */
    const unwindTransactionChain = (aTransactions) => {
        let oPurchaseOrder = aTransactions[0];
        let oSalesOrder = aTransactions[1];
        let oVendorBill = aTransactions[2];
        let oIntercoInvoice = aTransactions[3];

        // Unwind in reverse order of creation
        
        if (oIntercoInvoice) {
            record.delete({
                type: record.Type.INVOICE,
                id: oIntercoInvoice.id
            });
        }

        if (oVendorBill) {
            record.delete({
                type: record.Type.VENDOR_BILL,
                id: oVendorBill.id
            });
        }

        if (oSalesOrder) {
            // Clear the SO link to the PO to enable delete
            record.submitFields({
                type: record.Type.SALES_ORDER,
                id: oSalesOrder.id,
                values: {
                    'intercotransaction': ''
                },
                options: {
                    enablesourcing: true,
                    ignoreMandatoryFields: true
                }
            });

            // remove the SO so that we can safely run again
            record.delete({
                type: record.Type.SALES_ORDER,
                id: oSalesOrder.id
            });
        }
        
        if (oPurchaseOrder) {
            // remove the PO so that we can safely run again
            record.delete({
                type: record.Type.PURCHASE_ORDER,
                id: oPurchaseOrder.id
            });
        }
        
    }

    // ENTRY POINTS BELOW 

    /**
     * Get the input data.
     *
     * Find a list of fully commited sales orders from shopify that should
     * be turned into item fulfillments.
     *
     * @return {Array} Array of objects representing each order
     */
    const getInputData = () => {
        log.audit({
            title: 'getInputData',
            details: 'START OF RUN'
        });

        getParameters();

        let aBatch = [];

        let aFilters = [
            // {name: 'internalid', operator: search.Operator.ANYOF, values: ['1204']},   // for debugging
            {name: 'type', operator: search.Operator.ANYOF, values: ['CustInvc']},
            {name: 'subsidiary', operator: search.Operator.ANYOF, values: [NS_ENV.SUBSIDIARIES.US_LLC]}, 
            {name: 'mainline', operator: search.Operator.IS, values: true},
            {name: 'status', operator: search.Operator.ANYOF, values: ['CustInvc:A']},  // Open
            {name: 'recurringbill', operator: search.Operator.IS, values: true},
            {name: 'custbody_esp_auto_interco_po', operator: search.Operator.ANYOF, values: ['@NONE@']}
        ];

        const COLUMNS = {
            ID: {name: 'internalid', type: 'select'},
            TRANID: {name: 'tranid', type: 'text'},
            AMOUNT: {name: 'amountremaining', type: 'currency'}
        }

        let aColumns = [];

        for (let oField in COLUMNS) {
            aColumns.push(search.createColumn(COLUMNS[oField]));
        }

        let oSrch, oPagedData;

        try {
            oSrch = search.create({
                type: record.Type.INVOICE,
                filters: aFilters,
                columns: aColumns
            });

        } catch (e) {
            log.error({
                title: 'getInputData - Problem creating search',
                details: e
            });
        }

        
        try {
            oPagedData = oSrch.runPaged({
                pageSize: 1000
            });

            log.audit({title: 'Pending Invoice Count', details: oPagedData.count});

            oPagedData.pageRanges.forEach((pageRange) => {
                let oPage = oPagedData.fetch({
                    index: pageRange.index
                });

                if (aBatch.length == 4000) {
                    return;  // skip pages to completion if we have enough invoices
                } else {
                    oPage.data.forEach((invoice) => {

                        let oData = {
                            ID: invoice.getValue(COLUMNS.ID),
                            TRANID: invoice.getValue(COLUMNS.TRANID),
                            AMOUNT: invoice.getValue(COLUMNS.AMOUNT),
                        };

                        if (aBatch.length < PARAMETERS.MAX_BATCH.value) {
                            aBatch.push(oData);
                        }

                    });
                }

            });

        } catch (e) {
            log.error({
                title: 'getInputData - Problem collecting invoices',
                details: e
            });
        }

        log.audit({
            title: 'Invoices Count',
            details: {
                invoices: aBatch.length
            }
        });

        return aBatch;
    }

    /**
     * Processes each invoice to create the necessary supporting transactions 
     * 
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    const map = (context) => {
        let oRow = JSON.parse(context.value);

        let aTransactions = [];   // used to track the created transactions

        log.debug({title: 'map input', details: oRow});

        getParameters();

        let oInvoice, oPurchaseOrder, oSalesOrder, oVendorBill, oIntercoInvoice;

        // Get the root invoice record to process
        try {
            oInvoice = record.load({
                type: record.Type.INVOICE,
                id: oRow.ID,
                isDynamic: false
            });

        } catch (e) {
            log.error({title: 'Unable to load Invoice ' + oRow.ID ,details: e});
            return;  // if we don't get the record then there is nothing to do...         
        }

        const TRANID = oInvoice.getValue({ fieldId: 'tranid'});

        log.audit({title: 'Processing Invoice', details: TRANID});

        /*
         * Make a PO to the Parent.   This will be used to record
         * the value of the revenue that is to be transfered back 
         * in exchange for the provision of service(s).
         * Ensure it is approved so we can link it to the Sales Order
         * that we create later
         */
        try {
            oPurchaseOrder = createPurchaseOrder(oInvoice);

            aTransactions.push(oPurchaseOrder);

            log.debug({title: 'Intercompany purchase order created. ' + TRANID , details: oPurchaseOrder.id});

        } catch (e) {
            log.error({title: 'Intercompany purchase order create failed. ' + TRANID ,details: e});

            // The PO shouldn't have been created, so we don't need to unwind.
            return;
        }
        

        /*
         * Make a Sales Order in the Parent. This will be used to record
         * the value of the services that are sold to the US Subsidiary for the
         * specific invoice which is being processed.
         */        
        try {
            oSalesOrder = createSalesOrder(oInvoice, oPurchaseOrder.id);

            aTransactions.push(oSalesOrder);

            log.debug({title: 'Intercompany sales order created. ' + TRANID , details: oSalesOrder.id});    

        } catch (e) {
            log.error({title: 'Intercompany sales order create failed. ' + TRANID, details: e});

            unwindTransactionChain(aTransactions);
            
            return;
        }

        /*
         * Bill the Purchase Order and ensure the bill is approved.
         * Make the transaction ID indicate the related master invoice
         */
        try {
            oVendorBill = record.transform({
                fromType: record.Type.PURCHASE_ORDER,
                fromId: oPurchaseOrder.id,
                toType: record.Type.VENDOR_BILL,
                isDynamic: true
            });

            oVendorBill.setValue({
                fieldId: 'tranid',
                value: 'INTERCO-' + oInvoice.getValue({ fieldId: 'tranid'})
            });

            oVendorBill.setValue({
                fieldId: 'approvalstatus',
                value: '2' // Approved
            });
        
            oVendorBill.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            aTransactions.push(oVendorBill);

            log.debug({title: 'Vendor Bill created. ' + TRANID , details: oVendorBill.id});    


        } catch (e) {
            log.error({title: 'Vendor Bill create failed. ' + TRANID, details: e});

            unwindTransactionChain(aTransactions);
        }


        /*
         * Create the Bill in the Parent for the newly created Sales Order
         */
        try {
            oIntercoInvoice = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: oSalesOrder.id,
                toType: record.Type.INVOICE,
                isDynamic: true
            });

            oIntercoInvoice.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            aTransactions.push(oIntercoInvoice);

            log.debug({title: 'Bill for Sales Order created. ' + TRANID , details: oIntercoInvoice.id});    


        } catch (e) {
            log.error({title: 'Bill for Sales Order create failed. ' + TRANID, details: e});

            unwindTransactionChain(aTransactions);

        }


        /*
         * Once the chain of transactions are created, we need to link
         * the initiating invoice to the created purchase order.
         * 
         * This step prevents the Invoice from being processed again
         */
        try {
            record.submitFields({
                type: record.Type.INVOICE,
                id: oInvoice.id,
                values: {
                    'custbody_esp_auto_interco_po': oPurchaseOrder.id
                },
                options: {
                    enablesourcing: true,
                    ignoreMandatoryFields: true
                }
            });

            log.audit({title: 'Invoice completed. Linked to Purchase order ' + oPurchaseOrder.id, details: TRANID});

        } catch (e) {
            log.error({title: 'Unable to Link originating invoice to the PO. ' + TRANID, details: e});

            unwindTransactionChain(aTransactions);

        }
        
        /*
         * We do not need to write out a result set 
         * because there is nothing to reduce (combine)
         */

    }



    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    const summarize = (summary) => {
        log.audit('Summary Stats', { usage: summary.usage, concurrency: summary.concurrency, yields: summary.yields} );

        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error({
                title: 'Summarize Map - Error for key: ' + key,
                details: error
            });
        });

        summary.reduceSummary.errors.iterator().each(function (key, error) {
            log.error({
                title: 'Summarize Reduce - Error for key: ' + key,
                details: error
            });
        });

        log.audit({
            title: 'summarize',
            details: 'END OF RUN'
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };

});
