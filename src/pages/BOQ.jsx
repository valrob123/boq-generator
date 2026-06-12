import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useSettings } from '../context/SettingsContext';
import { useNotification } from '../context/NotificationContext';
import ContentCard from '../components/ContentCard';
import Sidebar from '../components/layout/Sidebar';
import AppHeader from '../components/layout/AppHeader';
import TotalsBar from '../components/layout/TotalsBar';
import StatCard from '../components/layout/StatCard';
import OpenDialog from '../components/layout/OpenDialog';
import BrandingDialog from '../components/layout/BrandingDialog';
import AuthDialog from '../components/layout/AuthDialog';
import CostDonut from '../components/charts/CostDonut';
import CategoryLegend from '../components/charts/CategoryLegend';
import CompositionBar from '../components/charts/CompositionBar';
import ProgressMeter from '../components/charts/ProgressMeter';
import { useSavedWork } from '../hooks/useSavedWork';
import { MODULES } from '../utils/storage';
import { previewNextNumber, commitNextNumber, resetCounter, DOC_PREFIXES } from '../utils/docNumber';
import {
  Plus, Download, FileText, Trash2, Edit2, Save, X, Calculator,
  ArrowUp, ArrowDown, Percent, RotateCcw, Sparkles, Info,
  LayoutDashboard, ClipboardList, FolderTree, ListChecks, PenLine, Layers,
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import ExcelJS from 'exceljs';

function BOQ() {
  const { boqItems, setBoqItems, requestLoad, deleteWork } = useApp();
  const { companyLogo } = useSettings();
  const { notify, confirm } = useNotification();
  
  // Form state
  const [newItem, setNewItem] = useState({
    item: '',
    category: '',
    description: '',
    unit: 'lot',
    quantity: '',
    unitCost: '',
    remarks: ''
  });

  // ---- Workspace navigation -------------------------------------------------
  // The app is organized into navigable sections instead of slide-in drawers.
  const [activeSection, setActiveSection] = useState('overview');
  const [navOpen, setNavOpen] = useState(false);        // mobile sidebar
  const [openDialog, setOpenDialog] = useState(false);  // "Open saved BOQ" modal
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(null);     // dashboard: hovered category
  const [accountOpen, setAccountOpen] = useState(false); // account / cloud sync modal

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  
  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);

  // Project info state
  const [projectInfo, setProjectInfo] = useState({
    boqNumber: '',
    projectName: '',
    projectLocation: '',
    client: '',
    contractNo: '',
    contractor: '',
    dateCreated: new Date().toISOString().split('T')[0],
    // Cover page (optional) — funding agency / tender identity
    agencyName: '',
    agencyTagline: '',
    tenderRef: '',
    showCoverPage: true
  });

  // Document info state
  const [documentInfo, setDocumentInfo] = useState({
    preparedBy: '',
    preparedByPosition: '',
    reviewedBy: '',
    reviewedByPosition: '',
    approvedBy: '',
    approvedByPosition: '',
    notedBy: '',
    notedByPosition: ''
  });

  // Calculation state
  const [contingency, setContingency] = useState(0);
  const [vat, setVat] = useState(0);
  const [profitMargin, setProfitMargin] = useState(0);
  const [overhead, setOverhead] = useState(0);
  const [escalation, setEscalation] = useState(0);
  const [miscellaneous, setMiscellaneous] = useState(0);
  
  // Custom additional cost items (name + percentage)
  const [additionalCosts, setAdditionalCosts] = useState([]);
  

  // ---- Save / continue-later wiring -----------------------------------------
  const [savedWorkName, setSavedWorkName] = useState('');

  // Number lifecycle (no skipping, continues unless reset). committedNumberRef
  // holds this BOQ's final number once saved; null = still a preview.
  const committedNumberRef = useRef(null);

  // The document name mirrors the auto-generated BOQ number by default. Once the
  // user types a custom name, this flips to true and the name stops auto-tracking
  // the number; clearing the field re-enables automatic mirroring.
  const nameManuallyEditedRef = useRef(false);

  // Apply a BOQ number to the project info and, unless the user has set a custom
  // document name, reflect that number as the document name.
  const applyNumber = (num, { force = false } = {}) => {
    setProjectInfo((prev) => ({ ...prev, boqNumber: num }));
    if (force || !nameManuallyEditedRef.current) {
      nameManuallyEditedRef.current = false;
      setSavedWorkName(num);
    }
  };

  // Update the document name from the editable name fields, tracking whether the
  // user has overridden the auto-generated number.
  const handleNameChange = (value) => {
    nameManuallyEditedRef.current = value.trim().length > 0;
    setSavedWorkName(value);
  };

  useEffect(() => {
    setProjectInfo((prev) => {
      if (prev.boqNumber) {
        committedNumberRef.current = prev.boqNumber;
        return prev;
      }
      const preview = previewNextNumber(DOC_PREFIXES.BOQ);
      if (!nameManuallyEditedRef.current) setSavedWorkName((name) => name || preview);
      return { ...prev, boqNumber: preview };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerateBoqNumber = () => {
    const preview = previewNextNumber(DOC_PREFIXES.BOQ);
    applyNumber(preview);
  };

  const resetBoqNumber = async () => {
    const ok = await confirm(
      'Reset BOQ numbering to 001 for this year? The next SAVED BOQ will be BOQ-' +
        new Date().getFullYear() +
        '-001.',
      { confirmText: 'Reset' },
    );
    if (!ok) return;
    const preview = resetCounter(DOC_PREFIXES.BOQ);
    committedNumberRef.current = null;
    applyNumber(preview, { force: true });
  };

  // Ref so the number is visible to getSnapshot synchronously at save time.
  const snapshotNumberRef = useRef('');

  const buildSnapshot = () => ({
    boqItems,
    categories,
    projectInfo: {
      ...projectInfo,
      boqNumber: snapshotNumberRef.current || projectInfo.boqNumber,
    },
    documentInfo,
    contingency,
    vat,
    profitMargin,
    overhead,
    escalation,
    miscellaneous,
    additionalCosts,
  });

  const applySnapshot = (snap) => {
    if (!snap) return;
    if (Array.isArray(snap.boqItems)) setBoqItems(snap.boqItems);
    if (Array.isArray(snap.categories) && snap.categories.length) setCategories(snap.categories);
    if (snap.projectInfo) {
      setProjectInfo(snap.projectInfo);
      committedNumberRef.current = snap.projectInfo.boqNumber || null;
      if (snap.projectInfo.boqNumber) {
        nameManuallyEditedRef.current = false;
        setSavedWorkName(snap.projectInfo.boqNumber);
      }
    }
    if (snap.documentInfo) setDocumentInfo(snap.documentInfo);
    if (snap.contingency != null) setContingency(snap.contingency);
    if (snap.vat != null) setVat(snap.vat);
    if (snap.profitMargin != null) setProfitMargin(snap.profitMargin);
    if (snap.overhead != null) setOverhead(snap.overhead);
    if (snap.escalation != null) setEscalation(snap.escalation);
    if (snap.miscellaneous != null) setMiscellaneous(snap.miscellaneous);
    if (Array.isArray(snap.additionalCosts)) setAdditionalCosts(snap.additionalCosts);
  };

  const { save, startNew, savedList } = useSavedWork({
    module: MODULES.BOQ,
    getSnapshot: buildSnapshot,
    applySnapshot,
    deriveMeta: (snap) => {
      const pi = (snap && snap.projectInfo) || {};
      const items = (snap && snap.boqItems) || [];
      let progress = 0;
      if (pi.projectName) progress += 30;
      if (items.length > 0) progress += 50;
      if (pi.contractNo || pi.contractor) progress += 20;
      return {
        name: savedWorkName || pi.boqNumber || pi.projectName || 'Untitled BOQ',
        projectName: pi.projectName || '',
        client: pi.client || '',
        status: progress >= 100 ? 'Completed' : 'Draft',
        progress,
      };
    },
  });

  // Save the current BOQ. New doc → commit next number; existing → reuse.
  const handleBoqSave = (overrideMeta = {}) => {
    let num = committedNumberRef.current;
    if (!num) {
      num = commitNextNumber(DOC_PREFIXES.BOQ);
      committedNumberRef.current = num;
      snapshotNumberRef.current = num;
      setProjectInfo((prev) => ({ ...prev, boqNumber: num }));
      if (!nameManuallyEditedRef.current) setSavedWorkName(num);
    } else {
      snapshotNumberRef.current = num;
    }
    return save(overrideMeta);
  };

  // Save as a brand-new BOQ: commit the NEXT number and save a fresh record.
  const handleBoqSaveAsNew = () => {
    const num = commitNextNumber(DOC_PREFIXES.BOQ);
    committedNumberRef.current = num;
    snapshotNumberRef.current = num;
    nameManuallyEditedRef.current = false;
    setProjectInfo((prev) => ({ ...prev, boqNumber: num }));
    setSavedWorkName(num);
    return save({ name: num }, { forceNew: true });
  };

  // Comprehensive Philippine Construction Materials Price Library (2024-2025)

  const [categories, setCategories] = useState([]);

  // New-category form state.
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      notify('Please enter a category name', 'warning');
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      notify('A category with that name already exists', 'warning');
      return;
    }
    const maxCode = categories.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0);
    const code = String(maxCode + 1).padStart(2, '0');
    const used = new Set(categories.map((c) => c.id));
    let id = null;
    for (let i = 0; i < 26; i += 1) {
      const letter = String.fromCharCode(65 + i);
      if (!used.has(letter)) { id = letter; break; }
    }
    if (!id) id = `X${code}`;
    setCategories([...categories, { id, name, code }]);
    setNewItem((prev) => ({ ...prev, category: id }));
    setNewCategoryName('');
  };

  const handleDeleteCategory = async (id) => {
    if (boqItems.some((i) => i.category === id)) {
      notify('This category still has items. Move or delete its items before removing it.', 'warning');
      return;
    }
    if (!(await confirm('Remove this category?', { confirmText: 'Remove', danger: true }))) return;
    const remaining = categories.filter((c) => c.id !== id);
    setCategories(remaining);
    setNewItem((prev) => (prev.category === id ? { ...prev, category: remaining[0] ? remaining[0].id : '' } : prev));
  };

  const handleRenameCategory = (id, nextName) => {
    const name = nextName.replace(/\s+/g, ' ').trimStart();
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  };

  // The auto-assigned code the NEXT added category will receive (for the live preview badge).
  const nextCategoryCode = String(
    categories.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0) + 1,
  ).padStart(2, '0');

  const units = [
    'lot', 'lump sum', 'pcs', 'set', 'unit',
    'm', 'm²', 'm³', 'lineal meter', 'sq.m', 'cu.m',
    'kg', 'metric ton', 'bags', 'sacks',
    'board feet', 'cu.ft',
    'panel', 'sheet', 'roll',
    'length', 'pair', 'group',
    'point', 'outlet', 'circuit'
  ];

  const handleAddItem = () => {
    if (newItem.item.trim() === '') {
      notify('Please enter item description', 'warning');
      return;
    }

    // Convert to numbers and ensure precision
    const unitCostNum = Number(parseFloat(newItem.unitCost).toFixed(2)) || 0;
    const quantityNum = Number(parseFloat(newItem.quantity).toFixed(2)) || 0;
    
    // Calculate total with proper precision (round to 2 decimal places)
    const total = Number((quantityNum * unitCostNum).toFixed(2));
    
    const item = {
      id: Date.now(),
      ...newItem,
      unitCost: unitCostNum,
      quantity: quantityNum,
      total
    };

    setBoqItems([...boqItems, item]);
    setNewItem({ 
      item: '', 
      category: newItem.category, 
      description: '', 
      unit: newItem.unit, 
      quantity: '', 
      unitCost: '',
      remarks: '' 
    });
  };

  const handleDeleteItem = async (id) => {
    if (await confirm('Delete this item from BOQ?', { confirmText: 'Delete', danger: true })) {
      setBoqItems(boqItems.filter(i => i.id !== id));
    }
  };

  const handleEditItem = (item) => {
    setEditingId(item.id);
    setEditingItem({ ...item });
  };

  const handleSaveEdit = () => {
    // Convert to numbers and ensure precision
    const unitCostNum = Number(parseFloat(editingItem.unitCost).toFixed(2)) || 0;
    const quantityNum = Number(parseFloat(editingItem.quantity).toFixed(2)) || 0;
    
    // Calculate total with proper precision (round to 2 decimal places)
    const total = Number((quantityNum * unitCostNum).toFixed(2));

    setBoqItems(boqItems.map(item => 
      item.id === editingId 
        ? { ...editingItem, unitCost: unitCostNum, quantity: quantityNum, total }
        : item
    ));
    setEditingId(null);
    setEditingItem(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingItem(null);
  };

  const handleDragStart = (e, item, categoryId) => {
    setDraggedItem({ item, categoryId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverIndex(index);
  };

  const handleDragLeave = () => {
    setDraggedOverIndex(null);
  };

  const handleDrop = (e, targetIndex, targetCategoryId) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.categoryId !== targetCategoryId) {
      setDraggedItem(null);
      setDraggedOverIndex(null);
      return;
    }

    const categoryItems = getCategoryItems(targetCategoryId);
    const draggedIndex = categoryItems.findIndex(i => i.id === draggedItem.item.id);
    
    if (draggedIndex === targetIndex) {
      setDraggedItem(null);
      setDraggedOverIndex(null);
      return;
    }

    // Reorder items within the same category
    const otherItems = boqItems.filter(item => item.category !== targetCategoryId);
    const reorderedCategoryItems = [...categoryItems];
    const [movedItem] = reorderedCategoryItems.splice(draggedIndex, 1);
    reorderedCategoryItems.splice(targetIndex, 0, movedItem);

    setBoqItems([...otherItems, ...reorderedCategoryItems]);
    setDraggedItem(null);
    setDraggedOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedOverIndex(null);
  };

  const handleMoveItemUp = (itemId, categoryId) => {
    const categoryItems = getCategoryItems(categoryId);
    const itemIndex = categoryItems.findIndex(i => i.id === itemId);
    
    if (itemIndex <= 0) return; // Already at top
    
    const otherItems = boqItems.filter(item => item.category !== categoryId);
    const reorderedCategoryItems = [...categoryItems];
    const [movedItem] = reorderedCategoryItems.splice(itemIndex, 1);
    reorderedCategoryItems.splice(itemIndex - 1, 0, movedItem);
    
    setBoqItems([...otherItems, ...reorderedCategoryItems]);
  };

  const handleMoveItemDown = (itemId, categoryId) => {
    const categoryItems = getCategoryItems(categoryId);
    const itemIndex = categoryItems.findIndex(i => i.id === itemId);
    
    if (itemIndex >= categoryItems.length - 1) return; // Already at bottom
    
    const otherItems = boqItems.filter(item => item.category !== categoryId);
    const reorderedCategoryItems = [...categoryItems];
    const [movedItem] = reorderedCategoryItems.splice(itemIndex, 1);
    reorderedCategoryItems.splice(itemIndex + 1, 0, movedItem);
    
    setBoqItems([...otherItems, ...reorderedCategoryItems]);
  };



  const calculateGrandTotal = () => {
    // Sum all item totals and round to 2 decimal places to avoid floating point errors
    const total = boqItems.reduce((sum, item) => {
      const itemTotal = Number(parseFloat(item.total).toFixed(2)) || 0;
      return sum + itemTotal;
    }, 0);
    return Number(total.toFixed(2));
  };

  const calculateSubtotal = () => {
    // Subtotal is the same as grand total (sum of all items)
    return Number(calculateGrandTotal().toFixed(2));
  };

  const calculateContingency = () => {
    const subtotal = calculateSubtotal();
    const contingencyPercent = Number(parseFloat(contingency).toFixed(2)) || 0;
    // Calculate contingency and round to 2 decimal places
    const contingencyAmount = (subtotal * contingencyPercent) / 100;
    return Number(contingencyAmount.toFixed(2));
  };

  const calculateProfitMargin = () => {
    const subtotal = calculateSubtotal();
    const profitPercent = Number(parseFloat(profitMargin).toFixed(2)) || 0;
    const profitAmount = (subtotal * profitPercent) / 100;
    return Number(profitAmount.toFixed(2));
  };

  const calculateOverhead = () => {
    const subtotal = calculateSubtotal();
    const overheadPercent = Number(parseFloat(overhead).toFixed(2)) || 0;
    const overheadAmount = (subtotal * overheadPercent) / 100;
    return Number(overheadAmount.toFixed(2));
  };

  const calculateEscalation = () => {
    const subtotal = calculateSubtotal();
    const escalationPercent = Number(parseFloat(escalation).toFixed(2)) || 0;
    const escalationAmount = (subtotal * escalationPercent) / 100;
    return Number(escalationAmount.toFixed(2));
  };

  const calculateMiscellaneous = () => {
    const subtotal = calculateSubtotal();
    const miscPercent = Number(parseFloat(miscellaneous).toFixed(2)) || 0;
    const miscAmount = (subtotal * miscPercent) / 100;
    return Number(miscAmount.toFixed(2));
  };

  const calculateAdditionalCosts = () => {
    const subtotal = calculateSubtotal();
    return additionalCosts.map(item => {
      const percent = Number(parseFloat(item.percentage).toFixed(2)) || 0;
      const amount = (subtotal * percent) / 100;
      return {
        ...item,
        amount: Number(amount.toFixed(2))
      };
    });
  };

  const calculateTotalAdditionalCosts = () => {
    return additionalCosts.reduce((sum, item) => {
      const percent = Number(parseFloat(item.percentage).toFixed(2)) || 0;
      const amount = (calculateSubtotal() * percent) / 100;
      return sum + amount;
    }, 0);
  };

  const calculateVAT = () => {
    const subtotal = calculateSubtotal();
    const contingencyAmount = calculateContingency();
    const profitAmount = calculateProfitMargin();
    const overheadAmount = calculateOverhead();
    const escalationAmount = calculateEscalation();
    const miscAmount = calculateMiscellaneous();
    const additionalAmount = calculateTotalAdditionalCosts();
    const vatPercent = Number(parseFloat(vat).toFixed(2)) || 0;
    
    // VAT is calculated on subtotal + all additions
    const vatableAmount = subtotal + contingencyAmount + profitAmount + overheadAmount + escalationAmount + miscAmount + additionalAmount;
    const vatAmount = (vatableAmount * vatPercent) / 100;
    
    return Number(vatAmount.toFixed(2));
  };

  const calculateProjectTotal = () => {
    const subtotal = calculateSubtotal();
    const contingencyAmount = calculateContingency();
    const profitAmount = calculateProfitMargin();
    const overheadAmount = calculateOverhead();
    const escalationAmount = calculateEscalation();
    const miscAmount = calculateMiscellaneous();
    const additionalAmount = calculateTotalAdditionalCosts();
    const vatAmount = calculateVAT();
    
    // Sum all components and round to 2 decimal places
    const total = subtotal + contingencyAmount + profitAmount + overheadAmount + escalationAmount + miscAmount + additionalAmount + vatAmount;
    return Number(total.toFixed(2));
  };

  const calculateWeight = (itemTotal) => {
    const grandTotal = calculateGrandTotal();
    
    // Handle division by zero
    if (grandTotal === 0 || isNaN(grandTotal)) return '0.00';
    
    // Ensure itemTotal is a number
    const itemTotalNum = Number(parseFloat(itemTotal).toFixed(2)) || 0;
    
    // Calculate weight percentage with proper precision
    const weight = (itemTotalNum / grandTotal) * 100;
    
    // Return as string with exactly 2 decimal places
    return weight.toFixed(2);
  };

  const calculateCategoryTotal = (categoryId) => {
    // Sum all items in the category with proper precision
    const total = boqItems
      .filter(item => item.category === categoryId)
      .reduce((sum, item) => {
        const itemTotal = Number(parseFloat(item.total).toFixed(2)) || 0;
        return sum + itemTotal;
      }, 0);
    
    return Number(total.toFixed(2));
  };

  const getCategoryItems = (categoryId) => {
    return boqItems.filter(item => item.category === categoryId);
  };

  const formatCurrency = (amount) => {
    return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatNumber = (num) => {
    return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const generateItemNumber = (categoryId, index) => {
    const cat = categories.find(c => c.id === categoryId);
    return `${cat.code}.${index + 1}`;
  };

  // Signatories are optional; exports proceed whether or not they are filled in.
  const validateSignatories = () => true;

  const handleExportExcel = async () => {
    if (!validateSignatories()) return;
    // ---- Palette & formats -------------------------------------------------
    const GREEN_DARK = 'FF312E81';
    const GREEN = 'FF4338CA';
    const GREEN_MED = 'FF6366F1';
    const GREEN_LIGHT = 'FFE0E7FF';
    const GREEN_TINT = 'FFEEF2FF';
    const ZEBRA = 'FFF7F8FD';
    const BORDER = 'FFCCD1E2';
    const TEXT = 'FF1C2622';
    const MUTED = 'FF5B6B62';
    const WHITE = 'FFFFFFFF';

    const PESO = '"₱"#,##0.00';
    const QTY = '#,##0.00';
    const PCT = '0.00"%"';

    const thin = { style: 'thin', color: { argb: BORDER } };
    const boxAll = { top: thin, left: thin, bottom: thin, right: thin };
    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const FONT = 'Calibri';

    const num2 = (v) => Number(parseFloat(v).toFixed(2)) || 0;
    const dateLong = new Date(projectInfo.dateCreated || Date.now()).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const genLong = new Date().toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // ---- Workbook ----------------------------------------------------------
    const wb = new ExcelJS.Workbook();
    wb.creator = documentInfo.preparedBy || 'BOQ Builder';
    wb.company = projectInfo.agencyName || projectInfo.client || '';
    wb.created = new Date();

    // Optional embedded logo (png / jpeg / gif data URLs only).
    let logoId = null;
    const logoMatch = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(companyLogo || '');
    if (logoMatch) {
      const raw = logoMatch[1].toLowerCase();
      const ext = raw === 'jpg' ? 'jpeg' : raw;
      try {
        logoId = wb.addImage({ base64: logoMatch[2], extension: ext });
      } catch {
        logoId = null;
      }
    }

    const footerFor = (label) => ({
      oddFooter: `&L&9Generated ${genLong}&C&9${label}&R&9Page &P of &N`,
      evenFooter: `&L&9Generated ${genLong}&C&9${label}&R&9Page &P of &N`,
    });

    // Shared signatory block. `ranges` = three [startCol,endCol] groups.
    const addSignatories = (ws, ranges, fullSpan) => {
      ws.addRow([]);
      ws.addRow([]);
      const labels = ['Prepared by:', 'Reviewed by:', 'Approved by:'];
      const names = [documentInfo.preparedBy, documentInfo.reviewedBy, documentInfo.approvedBy];
      const positions = [
        documentInfo.preparedByPosition,
        documentInfo.reviewedByPosition,
        documentInfo.approvedByPosition,
      ];

      const labelRow = ws.addRow([]);
      ranges.forEach(([s, e], i) => {
        ws.mergeCells(labelRow.number, s, labelRow.number, e);
        const c = ws.getCell(labelRow.number, s);
        c.value = labels[i];
        c.font = { name: FONT, size: 9, color: { argb: MUTED } };
        c.alignment = { horizontal: 'left', vertical: 'middle' };
      });

      const space = ws.addRow([]);
      space.height = 26;

      const nameRow = ws.addRow([]);
      ranges.forEach(([s, e], i) => {
        ws.mergeCells(nameRow.number, s, nameRow.number, e);
        const c = ws.getCell(nameRow.number, s);
        c.value = names[i] || '';
        c.font = { name: FONT, bold: true, size: 11, color: { argb: TEXT } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        for (let col = s; col <= e; col++) {
          ws.getCell(nameRow.number, col).border = {
            top: { style: 'thin', color: { argb: 'FF98A0B6' } },
          };
        }
      });

      const posRow = ws.addRow([]);
      ranges.forEach(([s, e], i) => {
        ws.mergeCells(posRow.number, s, posRow.number, e);
        const c = ws.getCell(posRow.number, s);
        c.value = positions[i] || '';
        c.font = { name: FONT, italic: true, size: 9, color: { argb: MUTED } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      if (documentInfo.notedBy) {
        ws.addRow([]);
        ws.addRow([]);
        const mid = ranges[1];
        const nl = ws.addRow([]);
        ws.mergeCells(nl.number, mid[0], nl.number, mid[1]);
        const lc = ws.getCell(nl.number, mid[0]);
        lc.value = 'Noted by:';
        lc.font = { name: FONT, size: 9, color: { argb: MUTED } };
        lc.alignment = { horizontal: 'left', vertical: 'middle' };

        const ns = ws.addRow([]);
        ns.height = 26;

        const nn = ws.addRow([]);
        ws.mergeCells(nn.number, mid[0], nn.number, mid[1]);
        const nc = ws.getCell(nn.number, mid[0]);
        nc.value = documentInfo.notedBy;
        nc.font = { name: FONT, bold: true, size: 11, color: { argb: TEXT } };
        nc.alignment = { horizontal: 'center', vertical: 'middle' };
        for (let col = mid[0]; col <= mid[1]; col++) {
          ws.getCell(nn.number, col).border = {
            top: { style: 'thin', color: { argb: 'FF98A0B6' } },
          };
        }

        const np = ws.addRow([]);
        ws.mergeCells(np.number, mid[0], np.number, mid[1]);
        const pc = ws.getCell(np.number, mid[0]);
        pc.value = documentInfo.notedByPosition || '';
        pc.font = { name: FONT, italic: true, size: 9, color: { argb: MUTED } };
        pc.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    };

    // =======================================================================
    // COVER SHEET
    // =======================================================================
    const cover = wb.addWorksheet('Cover', {
      views: [{ showGridLines: false }],
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        horizontalCentered: true,
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
      headerFooter: footerFor(projectInfo.boqNumber || 'Bill of Quantities'),
    });
    cover.columns = [{ width: 6 }, { width: 24 }, { width: 30 }, { width: 24 }, { width: 6 }];

    // Top accent band.
    const accent = cover.addRow([]);
    cover.mergeCells(accent.number, 1, accent.number, 5);
    for (let c = 1; c <= 5; c++) cover.getCell(accent.number, c).fill = fill(GREEN);
    accent.height = 8;

    // Logo (floats above reserved blank rows).
    if (logoId !== null) {
      for (let i = 0; i < 5; i++) cover.addRow([]).height = 20;
      cover.addImage(logoId, {
        tl: { col: 1.6, row: 1.6 },
        ext: { width: 230, height: 92 },
        editAs: 'oneCell',
      });
    } else {
      cover.addRow([]).height = 16;
    }

    const coverTitle = (text, opts = {}) => {
      const r = cover.addRow([]);
      cover.mergeCells(r.number, 1, r.number, 5);
      const c = cover.getCell(r.number, 1);
      c.value = text;
      c.font = {
        name: FONT,
        bold: opts.bold !== false,
        size: opts.size || 14,
        color: { argb: opts.color || GREEN },
        italic: !!opts.italic,
      };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      r.height = opts.height || 22;
      return r;
    };

    if (projectInfo.agencyName) coverTitle(projectInfo.agencyName, { size: 13, color: TEXT, height: 20 });
    if (projectInfo.agencyTagline) {
      coverTitle(projectInfo.agencyTagline, { size: 10, color: MUTED, italic: true, bold: false, height: 16 });
    }
    cover.addRow([]).height = 10;
    coverTitle('BILL OF QUANTITIES', { size: 24, color: GREEN, height: 38 });
    cover.addRow([]).height = 6;
    if (projectInfo.projectName) coverTitle(projectInfo.projectName, { size: 13, color: TEXT, height: 22 });
    if (projectInfo.boqNumber) coverTitle(projectInfo.boqNumber, { size: 12, color: GREEN_MED, height: 20 });
    if (projectInfo.tenderRef) {
      coverTitle(`Tender Ref: ${projectInfo.tenderRef}`, { size: 10, color: MUTED, bold: false, height: 16 });
    }
    cover.addRow([]).height = 16;

    const infoRow = (label, value) => {
      const r = cover.addRow([]);
      cover.mergeCells(r.number, 2, r.number, 2);
      cover.mergeCells(r.number, 3, r.number, 4);
      const l = cover.getCell(r.number, 2);
      l.value = label;
      l.font = { name: FONT, bold: true, size: 10, color: { argb: GREEN_DARK } };
      l.alignment = { horizontal: 'left', vertical: 'middle' };
      const v = cover.getCell(r.number, 3);
      v.value = value || '—';
      v.font = { name: FONT, size: 10, color: { argb: TEXT } };
      v.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      for (let c = 2; c <= 4; c++) {
        cover.getCell(r.number, c).border = { bottom: { style: 'hair', color: { argb: BORDER } } };
      }
      r.height = 22;
    };

    infoRow('Project Location', projectInfo.projectLocation);
    infoRow('Client / Owner', projectInfo.client);
    infoRow('Contract No.', projectInfo.contractNo);
    infoRow('Contractor', projectInfo.contractor);
    infoRow('Date', dateLong);

    addSignatories(cover, [[2, 2], [3, 3], [4, 4]], 5);

    // =======================================================================
    // DETAILED SHEET  (built first so the Summary can reference its subtotals)
    // Formula-based: Amount = Qty × Unit Cost, subtotals/totals via SUM/+.
    // =======================================================================
    const det = wb.addWorksheet('Detailed', {
      views: [{ showGridLines: false }],
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
      },
      headerFooter: footerFor('Bill of Quantities — Detailed'),
    });
    det.columns = [
      { width: 9 },
      { width: 50 },
      { width: 9 },
      { width: 12 },
      { width: 16 },
      { width: 11 },
      { width: 18 },
      { width: 22 },
    ];
    const NCOL = 8;

    const dTitle = (text, opts = {}) => {
      const r = det.addRow([]);
      det.mergeCells(r.number, 1, r.number, NCOL);
      const c = det.getCell(r.number, 1);
      c.value = text;
      c.font = { name: FONT, bold: opts.bold !== false, size: opts.size || 12, color: { argb: opts.color || GREEN } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      r.height = opts.height || 20;
      return r;
    };

    const dAccent = det.addRow([]);
    det.mergeCells(dAccent.number, 1, dAccent.number, NCOL);
    for (let c = 1; c <= NCOL; c++) det.getCell(dAccent.number, c).fill = fill(GREEN);
    dAccent.height = 6;
    dTitle('BILL OF QUANTITIES — DETAILED', { size: 16, height: 26 });
    dTitle(projectInfo.projectName || 'Project Name', { size: 11, color: TEXT, height: 18 });
    dTitle(projectInfo.projectLocation || '', { size: 9, color: MUTED, bold: false, height: 14 });
    dTitle(`${projectInfo.boqNumber || ''}    •    ${dateLong}`, { size: 9, color: MUTED, bold: false, height: 16 });
    det.addRow([]).height = 6;

    const headers = ['Item No.', 'Description', 'Unit', 'Quantity', 'Unit Cost', 'Weight %', 'Amount', 'Remarks'];
    const headerAligns = ['center', 'left', 'center', 'right', 'right', 'right', 'right', 'left'];
    const dHeader = det.addRow(headers);
    dHeader.height = 24;
    dHeader.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = fill(GREEN);
      cell.font = { name: FONT, bold: true, size: 10, color: { argb: WHITE } };
      cell.alignment = { horizontal: headerAligns[col - 1], vertical: 'middle', wrapText: true };
      cell.border = boxAll;
    });
    det.views = [{ state: 'frozen', ySplit: dHeader.number, showGridLines: false }];
    det.pageSetup.printTitlesRow = `${dHeader.number}:${dHeader.number}`;

    const detItemWeightCells = []; // { row, total }
    const detCatSubtotals = []; // { catId, row, total }

    categories.forEach((cat) => {
      const items = getCategoryItems(cat.id);
      if (items.length === 0) return;

      const band = det.addRow([`${cat.code} — ${cat.id}: ${cat.name}`]);
      det.mergeCells(band.number, 1, band.number, NCOL);
      for (let c = 1; c <= NCOL; c++) {
        const cell = det.getCell(band.number, c);
        cell.fill = fill(GREEN_MED);
        cell.border = boxAll;
      }
      const bc = det.getCell(band.number, 1);
      bc.font = { name: FONT, bold: true, size: 11, color: { argb: WHITE } };
      bc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      band.height = 20;

      let firstItemRow = null;
      let lastItemRow = null;

      items.forEach((item, index) => {
        const qty = num2(item.quantity);
        const cost = num2(item.unitCost);
        const amount = num2(item.total);
        const row = det.addRow([
          generateItemNumber(cat.id, index),
          item.item,
          item.unit,
          qty,
          cost,
          0,
          0,
          item.remarks || '',
        ]);
        const r = row.number;
        if (firstItemRow === null) firstItemRow = r;
        lastItemRow = r;

        const zebra = index % 2 === 1;
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.border = boxAll;
          cell.font = { name: FONT, size: 10, color: { argb: TEXT } };
          if (zebra) cell.fill = fill(ZEBRA);
          cell.alignment = { vertical: 'middle', wrapText: col === 2 || col === 8 };
        });
        det.getCell(r, 1).alignment = { horizontal: 'center', vertical: 'middle' };
        det.getCell(r, 3).alignment = { horizontal: 'center', vertical: 'middle' };
        det.getCell(r, 4).numFmt = QTY;
        det.getCell(r, 4).alignment = { horizontal: 'right', vertical: 'middle' };
        det.getCell(r, 5).numFmt = PESO;
        det.getCell(r, 5).alignment = { horizontal: 'right', vertical: 'middle' };
        det.getCell(r, 6).numFmt = PCT;
        det.getCell(r, 6).alignment = { horizontal: 'right', vertical: 'middle' };
        // Amount = Quantity (D) × Unit Cost (E)
        const am = det.getCell(r, 7);
        am.value = { formula: `D${r}*E${r}`, result: amount };
        am.numFmt = PESO;
        am.alignment = { horizontal: 'right', vertical: 'middle' };
        am.font = { name: FONT, size: 10, bold: true, color: { argb: GREEN } };
        detItemWeightCells.push({ row: r, total: item.total });
      });

      const subtotal = calculateCategoryTotal(cat.id);
      const subRow = det.addRow(['', 'Category Subtotal', '', '', '', 0, 0, '']);
      const sr = subRow.number;
      subRow.height = 18;
      subRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = fill(GREEN_LIGHT);
        cell.border = boxAll;
        cell.font = { name: FONT, bold: true, size: 10, color: { argb: GREEN_DARK } };
        cell.alignment = { vertical: 'middle' };
      });
      det.getCell(sr, 2).alignment = { horizontal: 'right', vertical: 'middle' };
      det.getCell(sr, 6).numFmt = PCT;
      det.getCell(sr, 6).alignment = { horizontal: 'right', vertical: 'middle' };
      // Category subtotal = SUM of this category's item amounts
      det.getCell(sr, 7).value = {
        formula: firstItemRow ? `SUM(G${firstItemRow}:G${lastItemRow})` : '0',
        result: num2(subtotal),
      };
      det.getCell(sr, 7).numFmt = PESO;
      det.getCell(sr, 7).alignment = { horizontal: 'right', vertical: 'middle' };
      detCatSubtotals.push({ catId: cat.id, row: sr, total: subtotal });

      det.addRow([]).height = 6;
    });

    const styleDTotal = (r, emphasize) => {
      const bg = emphasize ? GREEN : GREEN_TINT;
      const fg = emphasize ? WHITE : GREEN_DARK;
      det.getRow(r).height = emphasize ? 24 : 18;
      for (let c = 1; c <= NCOL; c++) {
        const cell = det.getCell(r, c);
        cell.fill = fill(bg);
        cell.border = boxAll;
        cell.font = { name: FONT, bold: true, size: emphasize ? 12 : 10, color: { argb: fg } };
        cell.alignment = { vertical: 'middle' };
      }
      det.getCell(r, 2).alignment = { horizontal: 'right', vertical: 'middle' };
      det.getCell(r, 7).numFmt = PESO;
      det.getCell(r, 7).alignment = { horizontal: 'right', vertical: 'middle' };
    };

    // SUBTOTAL = sum of the category subtotal cells
    const dSubtotalRow = det.addRow(['', 'SUBTOTAL', '', '', '', 100, 0, '']).number;
    styleDTotal(dSubtotalRow, false);
    det.getCell(dSubtotalRow, 6).numFmt = PCT;
    det.getCell(dSubtotalRow, 6).alignment = { horizontal: 'right', vertical: 'middle' };
    det.getCell(dSubtotalRow, 7).value = {
      formula: detCatSubtotals.length ? `SUM(${detCatSubtotals.map((x) => `G${x.row}`).join(',')})` : '0',
      result: num2(calculateSubtotal()),
    };

    const dAddonRows = [];
    const addDAddon = (label, pct, resultVal) => {
      const r = det.addRow(['', label, '', '', '', '', 0, '']).number;
      styleDTotal(r, false);
      det.getCell(r, 7).value = { formula: `G${dSubtotalRow}*${pct}/100`, result: resultVal };
      dAddonRows.push(r);
    };
    if (contingency > 0) addDAddon(`Contingency (${num2(contingency)}%)`, num2(contingency), num2(calculateContingency()));
    if (profitMargin > 0) addDAddon(`Profit Margin (${num2(profitMargin)}%)`, num2(profitMargin), num2(calculateProfitMargin()));
    if (overhead > 0) addDAddon(`Overhead (${num2(overhead)}%)`, num2(overhead), num2(calculateOverhead()));
    if (escalation > 0) addDAddon(`Escalation (${num2(escalation)}%)`, num2(escalation), num2(calculateEscalation()));
    if (miscellaneous > 0) addDAddon(`Miscellaneous (${num2(miscellaneous)}%)`, num2(miscellaneous), num2(calculateMiscellaneous()));
    calculateAdditionalCosts()
      .filter((i) => i.amount > 0)
      .forEach((i) => addDAddon(`${i.name} (${num2(i.percentage)}%)`, num2(i.percentage), num2(i.amount)));

    let dVatRow = null;
    if (vat > 0) {
      dVatRow = det.addRow(['', `VAT (${num2(vat)}%)`, '', '', '', '', 0, '']).number;
      styleDTotal(dVatRow, false);
      const base = dAddonRows.length
        ? `(G${dSubtotalRow}+${dAddonRows.map((r) => `G${r}`).join('+')})`
        : `G${dSubtotalRow}`;
      det.getCell(dVatRow, 7).value = { formula: `${base}*${num2(vat)}/100`, result: num2(calculateVAT()) };
    }

    const dTotalParts = [`G${dSubtotalRow}`, ...dAddonRows.map((r) => `G${r}`)];
    if (dVatRow) dTotalParts.push(`G${dVatRow}`);
    const dProjectTotalRow = det.addRow(['', 'PROJECT TOTAL', '', '', '', '', 0, '']).number;
    styleDTotal(dProjectTotalRow, true);
    det.getCell(dProjectTotalRow, 7).value = {
      formula: dTotalParts.join('+'),
      result: num2(calculateProjectTotal()),
    };

    // Weight % formulas (now that the SUBTOTAL cell row is known)
    detItemWeightCells.forEach(({ row, total }) => {
      const w = det.getCell(row, 6);
      w.value = { formula: `IFERROR(G${row}/G${dSubtotalRow}*100,0)`, result: parseFloat(calculateWeight(total)) || 0 };
      w.numFmt = PCT;
    });
    detCatSubtotals.forEach(({ row, total }) => {
      const w = det.getCell(row, 6);
      w.value = { formula: `IFERROR(G${row}/G${dSubtotalRow}*100,0)`, result: parseFloat(calculateWeight(total)) || 0 };
      w.numFmt = PCT;
    });

    addSignatories(det, [[1, 3], [4, 6], [7, 8]], NCOL);

    // =======================================================================
    // SUMMARY SHEET  (references the Detailed subtotals so it stays in sync)
    // =======================================================================
    const summary = wb.addWorksheet('Summary', {
      views: [{ showGridLines: false }],
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
      },
      headerFooter: footerFor('Bill of Quantities — Summary'),
    });
    summary.columns = [{ width: 9 }, { width: 10 }, { width: 48 }, { width: 14 }, { width: 20 }];
    const SNCOL = 5;

    const sTitle = (text, opts = {}) => {
      const r = summary.addRow([]);
      summary.mergeCells(r.number, 1, r.number, SNCOL);
      const c = summary.getCell(r.number, 1);
      c.value = text;
      c.font = { name: FONT, bold: opts.bold !== false, size: opts.size || 12, color: { argb: opts.color || GREEN } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      r.height = opts.height || 20;
      return r;
    };

    const sAccent = summary.addRow([]);
    summary.mergeCells(sAccent.number, 1, sAccent.number, SNCOL);
    for (let c = 1; c <= SNCOL; c++) summary.getCell(sAccent.number, c).fill = fill(GREEN);
    sAccent.height = 6;
    sTitle('BILL OF QUANTITIES — SUMMARY', { size: 16, height: 26 });
    sTitle(projectInfo.projectName || 'Project Name', { size: 11, color: TEXT, height: 18 });
    sTitle(projectInfo.projectLocation || '', { size: 9, color: MUTED, bold: false, height: 14 });
    sTitle(`${projectInfo.boqNumber || ''}    •    ${dateLong}`, { size: 9, color: MUTED, bold: false, height: 16 });
    summary.addRow([]).height = 6;

    const sHeader = summary.addRow(['ITEM', 'CODE', 'DESCRIPTION', 'WEIGHT %', 'AMOUNT (PHP)']);
    sHeader.height = 22;
    sHeader.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = fill(GREEN);
      cell.font = { name: FONT, bold: true, size: 10, color: { argb: WHITE } };
      cell.alignment = {
        horizontal: col === 3 ? 'left' : col === 1 || col === 2 ? 'center' : 'right',
        vertical: 'middle',
      };
      cell.border = boxAll;
    });
    summary.views = [{ state: 'frozen', ySplit: sHeader.number, showGridLines: false }];
    summary.pageSetup.printTitlesRow = `${sHeader.number}:${sHeader.number}`;

    const detSubRowByCat = {};
    detCatSubtotals.forEach((x) => { detSubRowByCat[x.catId] = x.row; });

    const sCatRows = []; // { row, total }
    let sZebra = 0;
    categories.forEach((cat) => {
      const total = calculateCategoryTotal(cat.id);
      if (total === 0) return;
      const row = summary.addRow([cat.id, cat.code, cat.name, 0, 0]);
      const r = row.number;
      const zebra = sZebra % 2 === 1;
      sZebra += 1;
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = boxAll;
        cell.font = { name: FONT, size: 10, color: { argb: TEXT } };
        if (zebra) cell.fill = fill(ZEBRA);
        cell.alignment = {
          horizontal: col === 3 ? 'left' : col === 1 || col === 2 ? 'center' : 'right',
          vertical: 'middle',
          wrapText: col === 3,
        };
      });
      summary.getCell(r, 4).numFmt = PCT;
      summary.getCell(r, 4).alignment = { horizontal: 'right', vertical: 'middle' };
      const amt = summary.getCell(r, 5);
      const detRow = detSubRowByCat[cat.id];
      amt.value = detRow ? { formula: `Detailed!G${detRow}`, result: num2(total) } : num2(total);
      amt.numFmt = PESO;
      amt.alignment = { horizontal: 'right', vertical: 'middle' };
      amt.font = { name: FONT, size: 10, bold: true, color: { argb: GREEN } };
      sCatRows.push({ row: r, total });
    });

    const styleSTotal = (r, emphasize) => {
      const bg = emphasize ? GREEN : GREEN_TINT;
      const fg = emphasize ? WHITE : GREEN_DARK;
      summary.getRow(r).height = emphasize ? 24 : 18;
      for (let c = 1; c <= SNCOL; c++) {
        const cell = summary.getCell(r, c);
        cell.fill = fill(bg);
        cell.border = boxAll;
        cell.font = { name: FONT, bold: true, size: emphasize ? 12 : 10, color: { argb: fg } };
        cell.alignment = { vertical: 'middle' };
      }
      summary.getCell(r, 3).alignment = { horizontal: 'right', vertical: 'middle' };
      summary.getCell(r, 5).numFmt = PESO;
      summary.getCell(r, 5).alignment = { horizontal: 'right', vertical: 'middle' };
    };

    // SUBTOTAL = sum of category amount cells
    const sSubtotalRow = summary.addRow(['', '', 'SUBTOTAL', 100, 0]).number;
    styleSTotal(sSubtotalRow, false);
    summary.getCell(sSubtotalRow, 4).numFmt = PCT;
    summary.getCell(sSubtotalRow, 4).alignment = { horizontal: 'right', vertical: 'middle' };
    summary.getCell(sSubtotalRow, 5).value = {
      formula: sCatRows.length ? `SUM(${sCatRows.map((x) => `E${x.row}`).join(',')})` : '0',
      result: num2(calculateSubtotal()),
    };

    const sAddonRows = [];
    const addSAddon = (label, pct, resultVal) => {
      const r = summary.addRow(['', '', label, '', 0]).number;
      styleSTotal(r, false);
      summary.getCell(r, 5).value = { formula: `E${sSubtotalRow}*${pct}/100`, result: resultVal };
      sAddonRows.push(r);
    };
    if (contingency > 0) addSAddon(`Contingency (${num2(contingency)}%)`, num2(contingency), num2(calculateContingency()));
    if (profitMargin > 0) addSAddon(`Profit Margin (${num2(profitMargin)}%)`, num2(profitMargin), num2(calculateProfitMargin()));
    if (overhead > 0) addSAddon(`Overhead (${num2(overhead)}%)`, num2(overhead), num2(calculateOverhead()));
    if (escalation > 0) addSAddon(`Escalation (${num2(escalation)}%)`, num2(escalation), num2(calculateEscalation()));
    if (miscellaneous > 0) addSAddon(`Miscellaneous (${num2(miscellaneous)}%)`, num2(miscellaneous), num2(calculateMiscellaneous()));
    calculateAdditionalCosts()
      .filter((i) => i.amount > 0)
      .forEach((i) => addSAddon(`${i.name} (${num2(i.percentage)}%)`, num2(i.percentage), num2(i.amount)));

    let sVatRow = null;
    if (vat > 0) {
      sVatRow = summary.addRow(['', '', `VAT (${num2(vat)}%)`, '', 0]).number;
      styleSTotal(sVatRow, false);
      const base = sAddonRows.length
        ? `(E${sSubtotalRow}+${sAddonRows.map((r) => `E${r}`).join('+')})`
        : `E${sSubtotalRow}`;
      summary.getCell(sVatRow, 5).value = { formula: `${base}*${num2(vat)}/100`, result: num2(calculateVAT()) };
    }

    const sTotalParts = [`E${sSubtotalRow}`, ...sAddonRows.map((r) => `E${r}`)];
    if (sVatRow) sTotalParts.push(`E${sVatRow}`);
    const sProjectTotalRow = summary.addRow(['', '', 'PROJECT TOTAL', '', 0]).number;
    styleSTotal(sProjectTotalRow, true);
    summary.getCell(sProjectTotalRow, 5).value = {
      formula: sTotalParts.join('+'),
      result: num2(calculateProjectTotal()),
    };

    // Category weight % = amount / subtotal
    sCatRows.forEach(({ row, total }) => {
      const w = summary.getCell(row, 4);
      w.value = { formula: `IFERROR(E${row}/E${sSubtotalRow}*100,0)`, result: parseFloat(calculateWeight(total)) || 0 };
      w.numFmt = PCT;
    });

    addSignatories(summary, [[1, 2], [3, 3], [4, 5]], SNCOL);

    // Keep the visible tab order Cover -> Summary -> Detailed.
    cover.orderNo = 0;
    summary.orderNo = 1;
    det.orderNo = 2;

    // ---- Write & download --------------------------------------------------
    const docBase = (savedWorkName || projectInfo.boqNumber || 'BOQ')
      .trim()
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'BOQ';
    const projSuffix = projectInfo.projectName
      ? `_${projectInfo.projectName.replace(/\s+/g, '_')}`
      : '';
    const filename = `${docBase}${projSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`;

    try {
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) {
      console.error('Excel export error:', error);
      notify('Error generating the Excel file. Please try again.', 'error');
    }
  };

  const handleExportPDF = () => {
    if (!validateSignatories()) return;
    const detailedCategoriesHTML = categories.map(cat => {
      const items = getCategoryItems(cat.id);
      if (items.length === 0) return '';

      return `
        <div style="page-break-inside: avoid; margin-top: 15px;">
          <h3 style="background: #4338ca; padding: 10px; margin: 0; color: #fff; font-size: 11pt; border: 2px solid #4338ca;">
            ${cat.code} - ${cat.id}: ${cat.name}
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 10px;">
            <thead>
              <tr style="background: #e0e7ff;">
                <th style="border: 1px solid #4338ca; padding: 5px; text-align: center; width: 50px;">Item No.</th>
                <th style="border: 1px solid #4338ca; padding: 5px; text-align: left;">Description</th>
                <th style="border: 1px solid #4338ca; padding: 5px; text-align: center; width: 50px;">Unit</th>
                <th style="border: 1px solid #4338ca; padding: 5px; text-align: right; width: 70px;">Quantity</th>
                <th style="border: 1px solid #4338ca; padding: 5px; text-align: right; width: 90px;">Unit Cost</th>
                <th style="border: 1px solid #4338ca; padding: 5px; text-align: right; width: 60px;">Weight %</th>
                <th style="border: 1px solid #4338ca; padding: 5px; text-align: right; width: 90px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, index) => `
                <tr style="background: #ffffff;">
                  <td style="border: 1px solid #ddd; padding: 5px; text-align: center; font-weight: 600;">${generateItemNumber(cat.id, index)}</td>
                  <td style="border: 1px solid #ddd; padding: 5px;">${item.item}</td>
                  <td style="border: 1px solid #ddd; padding: 5px; text-align: center;">${item.unit}</td>
                  <td style="border: 1px solid #ddd; padding: 5px; text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937;">${formatNumber(item.quantity)}</td>
                  <td style="border: 1px solid #ddd; padding: 5px; text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937;">${formatCurrency(item.unitCost)}</td>
                  <td style="border: 1px solid #ddd; padding: 5px; text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937;">${calculateWeight(item.total)}%</td>
                  <td style="border: 1px solid #ddd; padding: 5px; text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; font-weight: 600;">${formatCurrency(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background: #e0e7ff; font-weight: 700;">
                <td colspan="5" style="border: 1px solid #4338ca; padding: 8px; text-align: right;">Category Subtotal:</td>
                <td style="border: 1px solid #4338ca; padding: 8px; text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937;">${calculateWeight(calculateCategoryTotal(cat.id))}%</td>
                <td style="border: 1px solid #4338ca; padding: 8px; text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937;">${formatCurrency(calculateCategoryTotal(cat.id))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bill of Quantities</title>
        <style>
          @page { 
            margin: 15mm; 
            size: A4;
          }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 9pt;
            line-height: 1.4;
            color: #000;
          }
          .cover-page {
            page-break-after: always;
            min-height: 250mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            position: relative;
            padding-top: 10mm;
          }
          .cover-tender {
            position: absolute;
            top: 0;
            left: 0;
            font-size: 9pt;
            color: #333;
            text-align: left;
          }
          .cover-logo {
            margin-top: 28mm;
            max-height: 130px;
            max-width: 260px;
            object-fit: contain;
          }
          .cover-tagline {
            margin-top: 10px;
            font-style: italic;
            font-size: 11pt;
            color: #222;
            line-height: 1.5;
          }
          .cover-agency {
            margin-top: 14px;
            font-size: 12pt;
            font-weight: 700;
            color: #000;
          }
          .cover-project {
            margin-top: 30mm;
            font-size: 13pt;
            font-weight: 700;
            color: #000;
          }
          .cover-number {
            margin-top: 14px;
            font-size: 12pt;
            font-weight: 700;
            color: #000;
          }
          .cover-doctype {
            margin-top: 28mm;
            font-size: 20pt;
            font-weight: 700;
            color: #000;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 3px solid #4338ca;
            padding-bottom: 15px;
          }
          .header h1 {
            margin: 0;
            color: #4338ca;
            font-size: 18pt;
            font-weight: 700;
          }
          .header h2 {
            margin: 5px 0;
            color: #555;
            font-size: 12pt;
            font-weight: 600;
          }
          .project-info {
            margin: 15px 0;
            padding: 10px;
            background: #f7f8fd;
            border: 1px solid #ddd;
            font-size: 8pt;
          }
          .project-info table {
            width: 100%;
          }
          .project-info td {
            padding: 3px 8px;
          }
          .project-info td:first-child {
            font-weight: 600;
            width: 150px;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 9pt;
          }
          .summary-table th {
            background: #4338ca;
            color: #fff;
            padding: 10px;
            text-align: left;
            border: 1px solid #4338ca;
          }
          .summary-table td {
            padding: 8px;
            border: 1px solid #ddd;
            background: #ffffff;
            color: #000;
          }
          /* Uniform rows — no per-item alternating color, and always readable */
          .summary-table tr {
            background: #ffffff;
          }
          .grand-total {
            background: #4338ca !important;
            color: #fff !important;
            font-weight: 700;
            font-size: 11pt;
          }
          .signatures {
            margin-top: 40px;
            page-break-inside: avoid;
          }
          .signatures table {
            width: 100%;
            font-size: 9pt;
          }
          .signatures td {
            vertical-align: bottom;
            padding: 5px 15px;
          }
          .sig-label {
            font-size: 9pt;
            font-weight: 700;
            color: #333;
            margin-bottom: 50px;
          }
          .sig-line {
            border-top: 1px solid #000;
            padding-top: 5px;
            font-weight: 600;
            font-size: 10pt;
          }
          .sig-position {
            font-size: 8pt;
            color: #666;
            margin-top: 2px;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        ${projectInfo.showCoverPage ? `
        <div class="cover-page">
          ${projectInfo.tenderRef ? `<div class="cover-tender">${projectInfo.tenderRef}</div>` : ''}
          ${companyLogo ? `<img class="cover-logo" src="${companyLogo}" alt="logo" />` : ''}
          ${projectInfo.agencyTagline ? `<div class="cover-tagline">${projectInfo.agencyTagline.replace(/\n/g, '<br/>')}</div>` : ''}
          ${(projectInfo.agencyName || projectInfo.contractor) ? `<div class="cover-agency">${projectInfo.agencyName || projectInfo.contractor}</div>` : ''}
          ${projectInfo.projectName ? `<div class="cover-project">${projectInfo.projectName}</div>` : ''}
          ${(projectInfo.contractNo || projectInfo.boqNumber) ? `<div class="cover-number">${projectInfo.contractNo || projectInfo.boqNumber}</div>` : ''}
          <div class="cover-doctype">Bill of Quantity (BOQ)</div>
        </div>
        ` : ''}
        <div class="header">
          ${companyLogo ? `<img src="${companyLogo}" alt="logo" style="max-height: 64px; max-width: 220px; object-fit: contain; margin-bottom: 10px;" />` : ''}
          <h1>BILL OF QUANTITIES</h1>
          <h2>${projectInfo.projectName || 'PROJECT NAME'}</h2>
          <div style="font-size: 9pt; color: #666; margin-top: 8px;">
            ${projectInfo.projectLocation || 'Project Location'}
          </div>
        </div>

        <div class="project-info">
          <table>
            <tr>
              <td>BOQ No.:</td>
              <td>${projectInfo.boqNumber || 'N/A'}</td>
              <td>Contract No.:</td>
              <td>${projectInfo.contractNo || 'N/A'}</td>
            </tr>
            <tr>
              <td>Client:</td>
              <td>${projectInfo.client || 'N/A'}</td>
              <td>Contractor:</td>
              <td>${projectInfo.contractor || 'N/A'}</td>
            </tr>
            <tr>
              <td>Date:</td>
              <td>${new Date(projectInfo.dateCreated).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              <td></td>
              <td></td>
            </tr>
          </table>
        </div>

        <h3 style="color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 5px; margin-top: 25px;">COST SUMMARY</h3>
        <table class="summary-table">
          <thead>
            <tr>
              <th style="width: 60px;">Item</th>
              <th style="width: 60px;">Code</th>
              <th>Description</th>
              <th style="width: 80px; text-align: right;">Weight %</th>
              <th style="width: 120px; text-align: right;">Amount (PHP)</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map(cat => {
              const total = calculateCategoryTotal(cat.id);
              if (total === 0) return '';
              return `
                <tr>
                  <td style="text-align: center; font-weight: 700;">${cat.id}</td>
                  <td style="text-align: center; font-weight: 600;">${cat.code}</td>
                  <td style="font-weight: 600;">${cat.name}</td>
                  <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937;">${calculateWeight(total)}%</td>
                  <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; font-weight: 600;">${formatCurrency(total)}</td>
                </tr>
              `;
            }).join('')}
            <tr style="background: #e0e7ff; font-weight: 700;">
              <td colspan="3" style="text-align: right; font-size: 10pt; padding: 10px;">SUBTOTAL:</td>
              <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 10px;">100.00%</td>
              <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; font-size: 11pt; padding: 10px;">${formatCurrency(calculateSubtotal())}</td>
            </tr>
            ${contingency > 0 ? `
              <tr>
                <td colspan="3" style="text-align: right; padding: 8px;">Contingency (${contingency}%):</td>
                <td></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px;">${formatCurrency(calculateContingency())}</td>
              </tr>
            ` : ''}
            ${profitMargin > 0 ? `
              <tr>
                <td colspan="3" style="text-align: right; padding: 8px;">Profit Margin (${profitMargin}%):</td>
                <td></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px;">${formatCurrency(calculateProfitMargin())}</td>
              </tr>
            ` : ''}
            ${overhead > 0 ? `
              <tr>
                <td colspan="3" style="text-align: right; padding: 8px;">Overhead (${overhead}%):</td>
                <td></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px;">${formatCurrency(calculateOverhead())}</td>
              </tr>
            ` : ''}
            ${escalation > 0 ? `
              <tr>
                <td colspan="3" style="text-align: right; padding: 8px;">Escalation (${escalation}%):</td>
                <td></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px;">${formatCurrency(calculateEscalation())}</td>
              </tr>
            ` : ''}
            ${miscellaneous > 0 ? `
              <tr>
                <td colspan="3" style="text-align: right; padding: 8px;">Miscellaneous (${miscellaneous}%):</td>
                <td></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px;">${formatCurrency(calculateMiscellaneous())}</td>
              </tr>
            ` : ''}
            ${calculateAdditionalCosts().filter(item => item.amount > 0).map(item => `
              <tr>
                <td colspan="3" style="text-align: right; padding: 8px;">${item.name} (${item.percentage}%):</td>
                <td></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px;">${formatCurrency(item.amount)}</td>
              </tr>
            `).join('')}
            ${vat > 0 ? `
              <tr>
                <td colspan="3" style="text-align: right; padding: 8px;">VAT (${vat}%):</td>
                <td></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px;">${formatCurrency(calculateVAT())}</td>
              </tr>
            ` : ''}
            <tr class="grand-total">
              <td colspan="3" style="text-align: right; padding: 12px;">PROJECT TOTAL:</td>
              <td></td>
              <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 12px;">${formatCurrency(calculateProjectTotal())}</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures" style="margin-top: 50px;">
          <table>
            <tr>
              <td style="width: 33%;">
                <div class="sig-label">Prepared By:</div>
                <div class="sig-line">${documentInfo.preparedBy || ''}</div>
                <div class="sig-position">${documentInfo.preparedByPosition || ''}</div>
              </td>
              <td style="width: 33%;">
                <div class="sig-label">Reviewed By:</div>
                <div class="sig-line">${documentInfo.reviewedBy || ''}</div>
                <div class="sig-position">${documentInfo.reviewedByPosition || ''}</div>
              </td>
              <td style="width: 33%;">
                <div class="sig-label">Approved By:</div>
                <div class="sig-line">${documentInfo.approvedBy || ''}</div>
                <div class="sig-position">${documentInfo.approvedByPosition || ''}</div>
              </td>
            </tr>
          </table>
          ${documentInfo.notedBy ? `
            <table style="margin-top: 30px;">
              <tr>
                <td style="width: 50%;"></td>
                <td style="width: 50%;">
                  <div class="sig-label">Noted By:</div>
                  <div class="sig-line">${documentInfo.notedBy}</div>
                  <div class="sig-position">${documentInfo.notedByPosition || ''}</div>
                </td>
              </tr>
            </table>
          ` : ''}
        </div>

        <div style="page-break-before: always;"></div>

        <div class="header">
          <h1>DETAILED BILL OF QUANTITIES</h1>
          <h2>${projectInfo.projectName || 'PROJECT NAME'}</h2>
        </div>

        ${detailedCategoriesHTML}

        <div style="page-break-inside: avoid; margin-top: 25px;">
          <table class="summary-table">
            <tr style="background: #e0e7ff; font-weight: 700;">
              <td colspan="5" style="text-align: right; font-size: 10pt; padding: 10px; border: 1px solid #4338ca;">SUBTOTAL:</td>
              <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 10px; border: 1px solid #4338ca;">100.00%</td>
              <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; font-size: 11pt; padding: 10px; border: 1px solid #4338ca;">${formatCurrency(calculateSubtotal())}</td>
            </tr>
            ${contingency > 0 ? `
              <tr>
                <td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #ddd;">Contingency (${contingency}%):</td>
                <td style="border: 1px solid #ddd;"></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px; border: 1px solid #ddd;">${formatCurrency(calculateContingency())}</td>
              </tr>
            ` : ''}
            ${profitMargin > 0 ? `
              <tr>
                <td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #ddd;">Profit Margin (${profitMargin}%):</td>
                <td style="border: 1px solid #ddd;"></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px; border: 1px solid #ddd;">${formatCurrency(calculateProfitMargin())}</td>
              </tr>
            ` : ''}
            ${overhead > 0 ? `
              <tr>
                <td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #ddd;">Overhead (${overhead}%):</td>
                <td style="border: 1px solid #ddd;"></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px; border: 1px solid #ddd;">${formatCurrency(calculateOverhead())}</td>
              </tr>
            ` : ''}
            ${escalation > 0 ? `
              <tr>
                <td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #ddd;">Escalation (${escalation}%):</td>
                <td style="border: 1px solid #ddd;"></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px; border: 1px solid #ddd;">${formatCurrency(calculateEscalation())}</td>
              </tr>
            ` : ''}
            ${miscellaneous > 0 ? `
              <tr>
                <td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #ddd;">Miscellaneous (${miscellaneous}%):</td>
                <td style="border: 1px solid #ddd;"></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px; border: 1px solid #ddd;">${formatCurrency(calculateMiscellaneous())}</td>
              </tr>
            ` : ''}
            ${calculateAdditionalCosts().filter(item => item.amount > 0).map(item => `
              <tr>
                <td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #ddd;">${item.name} (${item.percentage}%):</td>
                <td style="border: 1px solid #ddd;"></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px; border: 1px solid #ddd;">${formatCurrency(item.amount)}</td>
              </tr>
            `).join('')}
            ${vat > 0 ? `
              <tr>
                <td colspan="5" style="text-align: right; padding: 8px; border: 1px solid #ddd;">VAT (${vat}%):</td>
                <td style="border: 1px solid #ddd;"></td>
                <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 8px; border: 1px solid #ddd;">${formatCurrency(calculateVAT())}</td>
              </tr>
            ` : ''}
            <tr class="grand-total">
              <td colspan="5" style="text-align: right; padding: 12px; border: 1px solid #4338ca;">PROJECT TOTAL:</td>
              <td style="border: 1px solid #4338ca;"></td>
              <td style="text-align: right; font-family: 'Courier New', 'DejaVu Sans Mono', monospace; font-weight: 600; color: #1f2937; padding: 12px; border: 1px solid #4338ca;">${formatCurrency(calculateProjectTotal())}</td>
            </tr>
          </table>
        </div>

        <div class="signatures">
          <table>
            <tr>
              <td style="width: 33%;">
                <div class="sig-label">Prepared By:</div>
                <div class="sig-line">${documentInfo.preparedBy || ''}</div>
                <div class="sig-position">${documentInfo.preparedByPosition || ''}</div>
              </td>
              <td style="width: 33%;">
                <div class="sig-label">Reviewed By:</div>
                <div class="sig-line">${documentInfo.reviewedBy || ''}</div>
                <div class="sig-position">${documentInfo.reviewedByPosition || ''}</div>
              </td>
              <td style="width: 33%;">
                <div class="sig-label">Approved By:</div>
                <div class="sig-line">${documentInfo.approvedBy || ''}</div>
                <div class="sig-position">${documentInfo.approvedByPosition || ''}</div>
              </td>
            </tr>
          </table>
          ${documentInfo.notedBy ? `
            <table style="margin-top: 30px;">
              <tr>
                <td style="width: 50%;"></td>
                <td style="width: 50%;">
                  <div class="sig-label">Noted By:</div>
                  <div class="sig-line">${documentInfo.notedBy}</div>
                  <div class="sig-position">${documentInfo.notedByPosition || ''}</div>
                </td>
              </tr>
            </table>
          ` : ''}
        </div>
      </body>
      </html>
    `;

    // Render into a detached, explicitly light-themed container so the app's
    // dark-mode CSS can never bleed into the exported PDF (was darkening the
    // zebra-striped summary rows). We strip the doctype/html/head wrapper and
    // mount the body markup under a node that forces light theme.
    const bodyMatch = htmlContent.match(/<body>([\s\S]*?)<\/body>/i);
    const innerBody = bodyMatch ? bodyMatch[1] : htmlContent;
    const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/i);
    const innerStyle = styleMatch ? styleMatch[1] : '';

    const printRoot = document.createElement('div');
    printRoot.setAttribute('data-theme', 'light');
    printRoot.className = 'rbv-print-root';
    // Inline the document styles + a hard light-mode reset for this subtree.
    printRoot.innerHTML = `
      <style>
        .rbv-print-root, .rbv-print-root * { color-scheme: light; }
        ${innerStyle}
      </style>
      ${innerBody}
    `;

    const pdfDocBase = (savedWorkName || projectInfo.boqNumber || 'BOQ')
      .trim()
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'BOQ';
    const pdfProjSuffix = projectInfo.projectName
      ? `_${projectInfo.projectName.replace(/\s+/g, '_')}`
      : '';

    const opt = {
      margin: 10,
      filename: `${pdfDocBase}${pdfProjSuffix}_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'png' },
      html2canvas: { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(printRoot).save();
  };

  // ---- Section model --------------------------------------------------------
  const SECTIONS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, desc: 'A live snapshot of this Bill of Quantities.' },
    { id: 'setup', label: 'Project Setup', icon: ClipboardList, desc: 'Identify the project and configure the cover page.' },
    { id: 'categories', label: 'Categories', icon: FolderTree, desc: 'Define the work divisions this BOQ is organized into.' },
    { id: 'items', label: 'Line Items', icon: ListChecks, desc: 'Add, price and arrange items under each category.' },
    { id: 'costs', label: 'Costs & Markups', icon: Percent, desc: 'Apply contingency, overhead, profit, VAT and more.' },
    { id: 'signoff', label: 'Sign-off', icon: PenLine, desc: 'Signatories who prepare, review and approve the document.' },
    { id: 'review', label: 'Review & Export', icon: FileText, desc: 'Preview the final document and export to Excel or PDF.' },
  ];
  const activeMeta = SECTIONS.find((s) => s.id === activeSection) || SECTIONS[0];
  const activeIndex = SECTIONS.findIndex((s) => s.id === activeSection);
  const prevSection = SECTIONS[activeIndex - 1] || null;
  const nextSection = SECTIONS[activeIndex + 1] || null;

  // ---- Derived figures ------------------------------------------------------
  const itemCount = boqItems.length;
  const categoryCount = categories.length;
  const subtotalValue = calculateSubtotal();
  const projectTotalValue = calculateProjectTotal();
  const markupsValue =
    calculateContingency() +
    calculateProfitMargin() +
    calculateOverhead() +
    calculateEscalation() +
    calculateMiscellaneous() +
    calculateTotalAdditionalCosts();
  const vatValue = calculateVAT();
  const status = itemCount > 0 && projectInfo.projectName ? 'Ready' : 'Draft';

  const totalsItems = [
    { label: 'Subtotal', value: formatCurrency(subtotalValue) },
    { label: 'Markups', value: formatCurrency(Number(markupsValue.toFixed(2))) },
    { label: 'VAT', value: formatCurrency(vatValue) },
    { label: 'Project Total', value: formatCurrency(projectTotalValue), strong: true },
  ];

  // ---- Shared: cost summary table (used on Overview) ------------------------
  const renderSummaryTable = () => (
    <table className="data-table" style={{ marginBottom: '0' }}>
      <thead>
        <tr>
          <th style={{ width: '70px', textAlign: 'center' }}>Item</th>
          <th style={{ width: '70px', textAlign: 'center' }}>Code</th>
          <th>Description</th>
          <th style={{ width: '110px', textAlign: 'right' }}>Weight %</th>
          <th style={{ width: '170px', textAlign: 'right' }}>Amount (PHP)</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((cat, index) => {
          const total = calculateCategoryTotal(cat.id);
          if (total === 0) return null;
          const bgColor = index % 2 === 0 ? 'var(--bq-surface)' : 'var(--bq-surface-2)';
          return (
            <tr
              key={cat.id}
              onMouseEnter={() => setActiveCat(cat.id)}
              onMouseLeave={() => setActiveCat(null)}
              onClick={() => setActiveSection('items')}
              style={{
                background: activeCat === cat.id ? 'var(--bq-accent-soft-bg)' : bgColor,
                cursor: 'pointer',
              }}
            >
              <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--bq-accent-text)' }}>{cat.id}</td>
              <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--bq-text-muted)' }}>{cat.code}</td>
              <td style={{ fontWeight: '600', color: 'var(--bq-text)' }}>{cat.name}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: 'var(--bq-text)' }}>{calculateWeight(total)}%</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: 'var(--bq-accent-text)' }}>{formatCurrency(total)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr style={{ background: 'var(--bq-accent-bg)' }}>
          <td colSpan="3" style={{ textAlign: 'right', padding: '13px', color: 'var(--bq-on-accent)', fontWeight: '800' }}>SUBTOTAL</td>
          <td style={{ textAlign: 'right', fontFamily: 'monospace', padding: '13px', color: 'var(--bq-on-accent)', fontWeight: '700' }}>100.00%</td>
          <td style={{ textAlign: 'right', fontFamily: 'monospace', padding: '13px', color: 'var(--bq-on-accent)', fontWeight: '800' }}>{formatCurrency(calculateSubtotal())}</td>
        </tr>
        {contingency > 0 && (
          <tr style={{ background: 'var(--bq-accent-bg)' }}><td colSpan="3" style={{ textAlign: 'right', padding: '10px', color: 'var(--bq-on-accent)', fontWeight: '700' }}>Contingency ({contingency}%)</td><td></td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', padding: '10px', color: 'var(--bq-on-accent)' }}>{formatCurrency(calculateContingency())}</td></tr>
        )}
        {profitMargin > 0 && (
          <tr style={{ background: 'var(--bq-accent-bg)' }}><td colSpan="3" style={{ textAlign: 'right', padding: '10px', color: 'var(--bq-on-accent)', fontWeight: '700' }}>Profit Margin ({profitMargin}%)</td><td></td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', padding: '10px', color: 'var(--bq-on-accent)' }}>{formatCurrency(calculateProfitMargin())}</td></tr>
        )}
        {overhead > 0 && (
          <tr style={{ background: 'var(--bq-accent-bg)' }}><td colSpan="3" style={{ textAlign: 'right', padding: '10px', color: 'var(--bq-on-accent)', fontWeight: '700' }}>Overhead ({overhead}%)</td><td></td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', padding: '10px', color: 'var(--bq-on-accent)' }}>{formatCurrency(calculateOverhead())}</td></tr>
        )}
        {escalation > 0 && (
          <tr style={{ background: 'var(--bq-accent-bg)' }}><td colSpan="3" style={{ textAlign: 'right', padding: '10px', color: 'var(--bq-on-accent)', fontWeight: '700' }}>Escalation ({escalation}%)</td><td></td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', padding: '10px', color: 'var(--bq-on-accent)' }}>{formatCurrency(calculateEscalation())}</td></tr>
        )}
        {miscellaneous > 0 && (
          <tr style={{ background: 'var(--bq-accent-bg)' }}><td colSpan="3" style={{ textAlign: 'right', padding: '10px', color: 'var(--bq-on-accent)', fontWeight: '700' }}>Miscellaneous ({miscellaneous}%)</td><td></td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', padding: '10px', color: 'var(--bq-on-accent)' }}>{formatCurrency(calculateMiscellaneous())}</td></tr>
        )}
        {calculateAdditionalCosts().map((item) => {
          if (item.amount === 0) return null;
          return (
            <tr key={item.id} style={{ background: 'var(--bq-accent-bg)' }}><td colSpan="3" style={{ textAlign: 'right', padding: '10px', color: 'var(--bq-on-accent)', fontWeight: '700' }}>{item.name} ({item.percentage}%)</td><td></td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', padding: '10px', color: 'var(--bq-on-accent)' }}>{formatCurrency(item.amount)}</td></tr>
          );
        })}
        {vat > 0 && (
          <tr style={{ background: 'var(--bq-accent-bg)' }}><td colSpan="3" style={{ textAlign: 'right', padding: '10px', color: 'var(--bq-on-accent)', fontWeight: '700' }}>VAT ({vat}%)</td><td></td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', padding: '10px', color: 'var(--bq-on-accent)' }}>{formatCurrency(calculateVAT())}</td></tr>
        )}
        <tr style={{ background: 'var(--bq-accent-strong)' }}>
          <td colSpan="3" style={{ textAlign: 'right', fontWeight: '800', fontSize: '16px', padding: '15px', color: 'var(--bq-on-accent)', letterSpacing: '0.5px' }}>PROJECT TOTAL</td>
          <td></td>
          <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '18px', fontFamily: 'monospace', padding: '15px', color: 'var(--bq-on-accent)' }}>{formatCurrency(calculateProjectTotal())}</td>
        </tr>
      </tfoot>
    </table>
  );

  // ---- Sections -------------------------------------------------------------
  const renderOverview = () => {
    // Category cost distribution (drives the donut, legend and table highlight).
    const CAT_COLORS = [
      '#4f46e5', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6',
      '#22c55e', '#ef4444', '#06b6d4', '#a855f7', '#eab308', '#3b82f6',
    ];
    const catSegments = categories
      .map((c) => ({ id: c.id, code: c.code, name: c.name, value: calculateCategoryTotal(c.id) }))
      .filter((c) => c.value > 0)
      .map((c, i) => ({
        ...c,
        pct: subtotalValue ? (c.value / subtotalValue) * 100 : 0,
        color: CAT_COLORS[i % CAT_COLORS.length],
      }));

    const compositionParts = [
      { label: 'Direct cost', value: subtotalValue, color: '#4f46e5' },
      { label: 'Markups', value: Number(markupsValue.toFixed(2)), color: '#0ea5e9' },
      { label: 'VAT', value: vatValue, color: '#14b8a6' },
    ];

    const completion = [
      { label: 'Project name', done: !!projectInfo.projectName },
      { label: 'Project location', done: !!projectInfo.projectLocation },
      { label: 'At least one category', done: categoryCount > 0 },
      { label: 'At least one line item', done: itemCount > 0 },
      { label: 'Contractor / contract no.', done: !!(projectInfo.contractor || projectInfo.contractNo) },
      { label: 'Prepared-by signatory', done: !!documentInfo.preparedBy },
    ];
    const completionPct = Math.round(
      (completion.filter((s) => s.done).length / completion.length) * 100,
    );

    return (
      <>
        <div className="stat-grid">
          <StatCard icon={<Layers size={18} />} label="Categories" value={categoryCount} tone="indigo" hint="Manage divisions" onClick={() => setActiveSection('categories')} />
          <StatCard icon={<ListChecks size={18} />} label="Line Items" value={itemCount} tone="blue" hint="Add & price" onClick={() => setActiveSection('items')} />
          <StatCard icon={<Calculator size={18} />} label="Subtotal" value={formatCurrency(subtotalValue)} tone="slate" mono hint="Edit markups" onClick={() => setActiveSection('costs')} />
          <StatCard icon={<Sparkles size={18} />} label="Project Total" value={formatCurrency(projectTotalValue)} tone="accent" mono hint="Review & export" onClick={() => setActiveSection('review')} />
        </div>

        {itemCount === 0 ? (
          <ContentCard title="Get started" height="auto">
            <div className="empty-inline">
              <Calculator size={42} />
              <h3>Your dashboard is empty</h3>
              <p>Add categories and line items to see live cost charts and totals here.</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveSection('categories')}>
                  <FolderTree size={16} /> Add categories
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setActiveSection('items')}>
                  <Plus size={16} /> Add line items
                </button>
              </div>
            </div>
          </ContentCard>
        ) : (
          <>
            <div className="overview-grid">
              <ContentCard title="Cost Distribution by Category" height="auto">
                <p className="field-hint" style={{ margin: '0 0 14px' }}>
                  Hover a slice or row to focus it; click to jump to its line items.
                </p>
                <div className="dist">
                  <CostDonut
                    segments={catSegments}
                    total={subtotalValue}
                    activeId={activeCat}
                    onHover={setActiveCat}
                    onSelect={() => setActiveSection('items')}
                    formatValue={formatCurrency}
                  />
                  <CategoryLegend
                    segments={catSegments}
                    activeId={activeCat}
                    onHover={setActiveCat}
                    onSelect={() => setActiveSection('items')}
                    formatValue={formatCurrency}
                  />
                </div>
              </ContentCard>

              <ContentCard title="Project Summary" height="auto">
                <dl className="summary-list">
                  <div><dt>BOQ No.</dt><dd className="is-mono">{projectInfo.boqNumber || '—'}</dd></div>
                  <div><dt>Project</dt><dd>{projectInfo.projectName || '—'}</dd></div>
                  <div><dt>Location</dt><dd>{projectInfo.projectLocation || '—'}</dd></div>
                  <div><dt>Client</dt><dd>{projectInfo.client || '—'}</dd></div>
                  <div><dt>Contractor</dt><dd>{projectInfo.contractor || '—'}</dd></div>
                </dl>
                <ProgressMeter percent={completionPct} steps={completion} />
                <button type="button" className="btn btn-secondary" style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }} onClick={() => setActiveSection('setup')}>
                  <ClipboardList size={16} /> Edit project details
                </button>
              </ContentCard>
            </div>

            <ContentCard title="Cost Composition" height="auto">
              <p className="field-hint" style={{ margin: '0 0 16px' }}>
                How the project total breaks down. Hover a segment for its share.
              </p>
              <CompositionBar parts={compositionParts} total={projectTotalValue} formatValue={formatCurrency} />
            </ContentCard>

            <ContentCard title="Cost Summary by Category" height="auto">
              {renderSummaryTable()}
            </ContentCard>
          </>
        )}
      </>
    );
  };

  const renderSetup = () => (
    <>
      <ContentCard title="Project Information" height="auto">
        <div className="field-grid">
          <div className="form-group">
            <label>BOQ Number (auto-generated)</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input type="text" className="doc-number-input" value={projectInfo.boqNumber} readOnly title="Automatically generated" style={{ flex: 1, minWidth: '120px' }} />
              <button type="button" className="doc-number-btn" onClick={regenerateBoqNumber} title="Generate the next number">
                <Sparkles size={15} /> Regenerate
              </button>
              <button type="button" className="doc-number-btn doc-number-btn--reset" onClick={resetBoqNumber} title="Reset numbering back to 001">
                <RotateCcw size={15} /> Reset to 001
              </button>
            </div>
            <p className="field-hint">
              This number is used as the document name automatically. Type your own name in the header to override it.
            </p>
          </div>
          <div className="form-group">
            <label>Project Name *</label>
            <input type="text" value={projectInfo.projectName} onChange={(e) => setProjectInfo({ ...projectInfo, projectName: e.target.value })} placeholder="Enter project name" />
          </div>
          <div className="form-group">
            <label>Project Location *</label>
            <input type="text" value={projectInfo.projectLocation} onChange={(e) => setProjectInfo({ ...projectInfo, projectLocation: e.target.value })} placeholder="Enter location" />
          </div>
          <div className="form-group">
            <label>Client</label>
            <input type="text" value={projectInfo.client} onChange={(e) => setProjectInfo({ ...projectInfo, client: e.target.value })} placeholder="Enter client name" />
          </div>
          <div className="form-group">
            <label>Contract Number</label>
            <input type="text" value={projectInfo.contractNo} onChange={(e) => setProjectInfo({ ...projectInfo, contractNo: e.target.value })} placeholder="e.g., CW-2024-XXX-001" />
          </div>
          <div className="form-group">
            <label>Contractor</label>
            <input type="text" value={projectInfo.contractor} onChange={(e) => setProjectInfo({ ...projectInfo, contractor: e.target.value })} placeholder="Enter contractor name" />
          </div>
          <div className="form-group">
            <label>Date Created</label>
            <input type="date" value={projectInfo.dateCreated} onChange={(e) => setProjectInfo({ ...projectInfo, dateCreated: e.target.value })} />
          </div>
        </div>
      </ContentCard>

      <ContentCard title="Cover Page" height="auto">
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={projectInfo.showCoverPage} onChange={(e) => setProjectInfo({ ...projectInfo, showCoverPage: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
            Include a cover page as the first page of the PDF
          </label>
          <p className="field-hint" style={{ margin: '6px 0 0 28px' }}>
            Uses your company logo (from branding) plus the fields below. The project info table and summary start on the next page.
          </p>
        </div>
        <div className="field-grid" style={{ opacity: projectInfo.showCoverPage ? 1 : 0.5 }}>
          <div className="form-group">
            <label>Agency / Organization Name</label>
            <input type="text" value={projectInfo.agencyName} disabled={!projectInfo.showCoverPage} onChange={(e) => setProjectInfo({ ...projectInfo, agencyName: e.target.value })} placeholder="e.g., Department of Health (defaults to Contractor)" />
          </div>
          <div className="form-group">
            <label>Tagline / Slogan (optional)</label>
            <input type="text" value={projectInfo.agencyTagline} disabled={!projectInfo.showCoverPage} onChange={(e) => setProjectInfo({ ...projectInfo, agencyTagline: e.target.value })} placeholder="e.g., Empowered lives. Resilient nations." />
          </div>
          <div className="form-group">
            <label>Tender / ITB Reference (top-left)</label>
            <input type="text" value={projectInfo.tenderRef} disabled={!projectInfo.showCoverPage} onChange={(e) => setProjectInfo({ ...projectInfo, tenderRef: e.target.value })} placeholder="e.g., ITB 2013-087" />
          </div>
        </div>
      </ContentCard>
    </>
  );

  const renderCategories = () => (
    <ContentCard title="Manage Categories" height="auto">
      <p style={{ margin: '0 0 16px', color: 'var(--bq-text-muted)', fontSize: '13px' }}>
        Create the work divisions for this BOQ. Each one is auto-numbered and flows into the item dropdown, the summary, and all exports.
      </p>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', background: 'var(--bq-surface-2)', border: '1px solid var(--bq-border)', borderRadius: '10px', padding: '10px', marginBottom: categories.length ? '18px' : '0' }}>
        <div title="Next category number" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '46px', borderRadius: '8px', background: 'var(--bq-accent-bg)', color: 'var(--bq-on-accent)', fontWeight: 700, fontFamily: 'monospace', fontSize: '15px' }}>
          {nextCategoryCode}
        </div>
        <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }} placeholder="Type a category name, e.g. Earthworks" aria-label="New category name" style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid var(--bq-border)', borderRadius: '8px', background: 'var(--bq-surface)', color: 'var(--bq-text)', fontSize: '14px' }} />
        <button type="button" className="btn btn-primary" onClick={handleAddCategory} disabled={!newCategoryName.trim()} style={{ whiteSpace: 'nowrap', opacity: newCategoryName.trim() ? 1 : 0.6 }}>
          <Plus size={18} /> Add
        </button>
      </div>

      {categories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '22px 16px', color: 'var(--bq-text-faint)', fontSize: '13px', border: '1px dashed var(--bq-border)', borderRadius: '10px', marginTop: '16px' }}>
          No categories yet. Add your first one above to start building the BOQ.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {categories.map((cat) => {
            const count = getCategoryItems(cat.id).length;
            const locked = count > 0;
            return (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 10px', background: 'var(--bq-surface)', border: '1px solid var(--bq-border)', borderRadius: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', height: '36px', borderRadius: '8px', background: 'var(--bq-accent-soft-bg)', color: 'var(--bq-accent-text)', fontWeight: 700, fontFamily: 'monospace', fontSize: '14px' }}>{cat.code}</span>
                <span style={{ color: 'var(--bq-text-muted)', fontWeight: 700, fontSize: '13px', width: '18px', textAlign: 'center' }}>{cat.id}</span>
                <input type="text" value={cat.name} onChange={(e) => handleRenameCategory(cat.id, e.target.value)} aria-label={`Rename category ${cat.id}`} style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid transparent', borderRadius: '6px', background: 'transparent', color: 'var(--bq-text)', fontSize: '14px' }} onFocus={(e) => { e.target.style.borderColor = 'var(--bq-border)'; e.target.style.background = 'var(--bq-surface-2)'; }} onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }} />
                <span style={{ fontSize: '12px', color: 'var(--bq-text-faint)', whiteSpace: 'nowrap' }}>{count} {count === 1 ? 'item' : 'items'}</span>
                <button type="button" className="btn-action" onClick={() => handleDeleteCategory(cat.id)} title={locked ? 'Remove its items before deleting' : 'Delete category'} style={{ color: locked ? 'var(--bq-text-faint)' : 'var(--bq-danger)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ContentCard>
  );

  const renderItems = () => (
    <>
      <ContentCard title="Add New Item" height="auto">
        {categories.length === 0 ? (
          <div className="empty-inline">
            <FolderTree size={40} />
            <p>Add at least one category before entering items.</p>
            <button type="button" className="btn btn-primary" onClick={() => setActiveSection('categories')}>
              <Plus size={16} /> Go to Categories
            </button>
          </div>
        ) : (
          <div className="boq-additem-row">
            <div className="form-group">
              <label>Category</label>
              <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} style={{ padding: '10px 8px', border: '1px solid var(--bq-border)', borderRadius: '6px', fontSize: '14px' }}>
                {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.id} - {cat.name}</option>))}
              </select>
            </div>
            <div className="form-group">
              <label>Item Description *</label>
              <input type="text" value={newItem.item} onChange={(e) => setNewItem({ ...newItem, item: e.target.value })} placeholder="Enter item description" />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} style={{ padding: '10px 8px', border: '1px solid var(--bq-border)', borderRadius: '6px', fontSize: '14px' }}>
                {units.map((unit) => (<option key={unit} value={unit}>{unit}</option>))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input type="number" value={newItem.quantity} onChange={(e) => { const value = e.target.value; if (value === '' || /^\d*\.?\d*$/.test(value)) { setNewItem({ ...newItem, quantity: value }); } }} onBlur={() => { if (newItem.quantity === '' || newItem.quantity === null) { setNewItem({ ...newItem, quantity: '' }); } else { const rounded = Number(parseFloat(newItem.quantity).toFixed(2)) || 0; setNewItem({ ...newItem, quantity: rounded }); } }} min="0" step="0.01" placeholder="0" />
            </div>
            <div className="form-group">
              <label>Unit Cost (₱)</label>
              <input type="text" value={newItem.unitCost === 0 || newItem.unitCost === '' ? '' : String(newItem.unitCost).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={(e) => { let value = e.target.value.replace(/,/g, ''); if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) { setNewItem({ ...newItem, unitCost: value === '' ? '' : value }); } }} onBlur={() => { if (newItem.unitCost === '' || newItem.unitCost === null) { setNewItem({ ...newItem, unitCost: '' }); } else { const numValue = Number(parseFloat(newItem.unitCost).toFixed(2)) || 0; setNewItem({ ...newItem, unitCost: numValue }); } }} placeholder="0.00" />
            </div>
            <button type="button" className="btn btn-primary" onClick={handleAddItem} style={{ marginBottom: '0' }}>
              <Plus size={18} /> Add Item
            </button>
          </div>
        )}
      </ContentCard>

      {categories.map((cat) => {
        const items = getCategoryItems(cat.id);
        if (items.length === 0) return null;
        return (
          <ContentCard
            key={cat.id}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>{`${cat.code} - ${cat.id}: ${cat.name}`}</span>
                <span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.9 }}>Drag rows or use ↑↓ to reorder</span>
              </div>
            }
            height="auto"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Item No.</th>
                  <th>Description</th>
                  <th style={{ width: '90px' }}>Unit</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Quantity</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Unit Cost (₱)</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Weight %</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Amount (₱)</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item.id}
                    draggable={editingId !== item.id}
                    onDragStart={(e) => handleDragStart(e, item, cat.id)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index, cat.id)}
                    onDragEnd={handleDragEnd}
                    style={{ cursor: editingId === item.id ? 'default' : 'move', borderTop: draggedOverIndex === index && draggedItem?.categoryId === cat.id ? '3px solid var(--bq-accent-border)' : undefined, opacity: draggedItem?.item.id === item.id ? 0.5 : 1 }}
                  >
                    {editingId === item.id ? (
                      <>
                        <td style={{ textAlign: 'center', fontWeight: '700', fontSize: '13px', background: 'var(--bq-warning-soft-bg)' }}>{generateItemNumber(cat.id, index)}</td>
                        <td style={{ background: 'var(--bq-warning-soft-bg)' }}>
                          <input type="text" value={editingItem.item} onChange={(e) => setEditingItem({ ...editingItem, item: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid var(--bq-border)', borderRadius: '4px' }} />
                        </td>
                        <td style={{ background: 'var(--bq-warning-soft-bg)' }}>
                          <select value={editingItem.unit} onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid var(--bq-border)', borderRadius: '4px' }}>
                            {units.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td style={{ background: 'var(--bq-warning-soft-bg)' }}>
                          <input type="number" value={editingItem.quantity} onChange={(e) => { const value = e.target.value; if (value === '' || (!isNaN(value) && parseFloat(value) >= 0)) { setEditingItem({ ...editingItem, quantity: value === '' ? 0 : parseFloat(value) }); } }} onBlur={() => { const rounded = Number(parseFloat(editingItem.quantity).toFixed(2)) || 0; setEditingItem({ ...editingItem, quantity: rounded }); }} style={{ width: '100%', padding: '6px', border: '1px solid var(--bq-border)', borderRadius: '4px', textAlign: 'right' }} step="0.01" min="0" />
                        </td>
                        <td style={{ background: 'var(--bq-warning-soft-bg)' }}>
                          <input type="number" value={editingItem.unitCost} onChange={(e) => { const value = e.target.value; if (value === '' || (!isNaN(value) && parseFloat(value) >= 0)) { setEditingItem({ ...editingItem, unitCost: value === '' ? 0 : parseFloat(value) }); } }} onBlur={() => { const rounded = Number(parseFloat(editingItem.unitCost).toFixed(2)) || 0; setEditingItem({ ...editingItem, unitCost: rounded }); }} style={{ width: '100%', padding: '6px', border: '1px solid var(--bq-border)', borderRadius: '4px', textAlign: 'right' }} step="0.01" min="0" />
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', background: 'var(--bq-warning-soft-bg)' }}>{calculateWeight(editingItem.quantity * editingItem.unitCost)}%</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', background: 'var(--bq-warning-soft-bg)' }}>{formatCurrency(editingItem.quantity * editingItem.unitCost)}</td>
                        <td style={{ textAlign: 'center', background: 'var(--bq-warning-soft-bg)' }}>
                          <button type="button" className="btn-action" onClick={handleSaveEdit} style={{ color: 'var(--bq-success)', marginRight: '6px' }} title="Save"><Save size={14} /></button>
                          <button type="button" className="btn-action" onClick={handleCancelEdit} style={{ color: 'var(--bq-text-muted)' }} title="Cancel"><X size={14} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: 'center', fontWeight: '700', fontSize: '13px', color: 'var(--bq-accent-text)' }}>{generateItemNumber(cat.id, index)}</td>
                        <td>{item.item}</td>
                        <td style={{ textAlign: 'center' }}>{item.unit}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(item.quantity)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(item.unitCost)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: 'var(--bq-text-muted)' }}>{calculateWeight(item.total)}%</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: 'var(--bq-accent-text)' }}>{formatCurrency(item.total)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button type="button" className="btn-action" onClick={() => handleMoveItemUp(item.id, cat.id)} disabled={index === 0} style={{ color: index === 0 ? 'var(--bq-text-faint)' : 'var(--bq-text-muted)', marginRight: '4px' }} title="Move Up"><ArrowUp size={14} /></button>
                          <button type="button" className="btn-action" onClick={() => handleMoveItemDown(item.id, cat.id)} disabled={index === items.length - 1} style={{ color: index === items.length - 1 ? 'var(--bq-text-faint)' : 'var(--bq-text-muted)', marginRight: '4px' }} title="Move Down"><ArrowDown size={14} /></button>
                          <button type="button" className="btn-action" onClick={() => handleEditItem(item)} style={{ color: 'var(--bq-info)', marginRight: '4px' }} title="Edit"><Edit2 size={14} /></button>
                          <button type="button" className="btn-action" onClick={() => handleDeleteItem(item.id)} style={{ color: 'var(--bq-danger)' }} title="Delete"><Trash2 size={14} /></button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bq-accent-soft-bg)', fontWeight: '700' }}>
                  <td colSpan="5" style={{ textAlign: 'right', padding: '10px' }}>Category Subtotal:</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', padding: '10px' }}>{calculateWeight(calculateCategoryTotal(cat.id))}%</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '15px', color: 'var(--bq-accent-text)', padding: '10px' }}>{formatCurrency(calculateCategoryTotal(cat.id))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </ContentCard>
        );
      })}

      {boqItems.length === 0 && categories.length > 0 && (
        <div style={{ textAlign: 'center', padding: '52px 20px', background: 'var(--bq-surface-2)', borderRadius: '12px', border: '2px dashed var(--bq-border)' }}>
          <Calculator size={56} style={{ color: 'var(--bq-text-faint)', marginBottom: '14px' }} />
          <h3 style={{ color: 'var(--bq-text-faint)', fontSize: '17px', marginBottom: '6px' }}>No items added yet</h3>
          <p style={{ color: 'var(--bq-text-faint)', fontSize: '14px' }}>Use the form above to add items to your Bill of Quantities.</p>
        </div>
      )}
    </>
  );

  const renderCosts = () => {
    const markupFields = [
      { label: 'Contingency', value: contingency, set: setContingency },
      { label: 'Profit Margin', value: profitMargin, set: setProfitMargin },
      { label: 'Overhead', value: overhead, set: setOverhead },
      { label: 'Escalation', value: escalation, set: setEscalation },
      { label: 'Miscellaneous', value: miscellaneous, set: setMiscellaneous },
    ];
    return (
      <ContentCard title="Cost Calculations" height="auto">
        <div className="field-grid field-grid--tight" style={{ marginBottom: '20px' }}>
          {markupFields.map((f) => (
            <div className="form-group" key={f.label}>
              <label>{f.label} (%)</label>
              <input type="number" value={f.value} onChange={(e) => f.set(e.target.value)} onBlur={() => f.set(Number(parseFloat(f.value).toFixed(2)) || 0)} min="0" max="100" step="0.1" placeholder="0.00" />
            </div>
          ))}
          <div className="form-group">
            <label>VAT (%)</label>
            <input type="number" value={vat} onChange={(e) => setVat(e.target.value)} onBlur={() => setVat(Number(parseFloat(vat).toFixed(2)) || 0)} min="0" max="100" step="0.1" placeholder="12.00" />
          </div>
        </div>

        {additionalCosts.map((item, index) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '16px', marginBottom: '16px', alignItems: 'end' }}>
            <div className="form-group">
              <label>Cost Name</label>
              <input type="text" value={item.name} onChange={(e) => { const updated = [...additionalCosts]; updated[index].name = e.target.value; setAdditionalCosts(updated); }} placeholder="e.g., Insurance, Bonds, etc." />
            </div>
            <div className="form-group">
              <label>Percentage (%)</label>
              <input type="number" value={item.percentage} onChange={(e) => { const updated = [...additionalCosts]; updated[index].percentage = e.target.value; setAdditionalCosts(updated); }} onBlur={() => { const updated = [...additionalCosts]; updated[index].percentage = Number(parseFloat(item.percentage).toFixed(2)) || 0; setAdditionalCosts(updated); }} min="0" max="100" step="0.1" placeholder="0.00" />
            </div>
            <button type="button" className="btn" onClick={() => setAdditionalCosts(additionalCosts.filter((_, i) => i !== index))} style={{ marginBottom: '0', padding: '10px 16px', background: 'var(--bq-danger)', color: 'var(--bq-on-accent)', border: 'none' }}>
              <X size={16} />
            </button>
          </div>
        ))}

        <button type="button" className="btn btn-secondary" onClick={() => setAdditionalCosts([...additionalCosts, { id: Date.now(), name: '', percentage: 0 }])} style={{ marginBottom: '22px' }}>
          <Plus size={18} /> Add Custom Cost Item
        </button>

        <div className="stat-grid">
          <StatCard icon={<Calculator size={18} />} label="Subtotal" value={formatCurrency(calculateSubtotal())} tone="slate" mono />
          <StatCard icon={<Percent size={18} />} label="Markups" value={formatCurrency(Number(markupsValue.toFixed(2)))} tone="indigo" mono />
          <StatCard icon={<Info size={18} />} label="VAT" value={formatCurrency(calculateVAT())} tone="blue" mono />
          <StatCard icon={<Sparkles size={18} />} label="Project Total" value={formatCurrency(calculateProjectTotal())} tone="accent" mono />
        </div>
      </ContentCard>
    );
  };

  const renderSignoff = () => (
    <>
      <ContentCard title="Document Signatories" height="auto">
        <div className="field-grid">
          <div className="form-group"><label>Prepared By *</label><input type="text" value={documentInfo.preparedBy} onChange={(e) => setDocumentInfo({ ...documentInfo, preparedBy: e.target.value })} placeholder="Name" /></div>
          <div className="form-group"><label>Position</label><input type="text" value={documentInfo.preparedByPosition} onChange={(e) => setDocumentInfo({ ...documentInfo, preparedByPosition: e.target.value })} placeholder="Position/Title" /></div>
          <div className="form-group"><label>Reviewed By *</label><input type="text" value={documentInfo.reviewedBy} onChange={(e) => setDocumentInfo({ ...documentInfo, reviewedBy: e.target.value })} placeholder="Name" /></div>
          <div className="form-group"><label>Position</label><input type="text" value={documentInfo.reviewedByPosition} onChange={(e) => setDocumentInfo({ ...documentInfo, reviewedByPosition: e.target.value })} placeholder="Position/Title" /></div>
          <div className="form-group"><label>Approved By *</label><input type="text" value={documentInfo.approvedBy} onChange={(e) => setDocumentInfo({ ...documentInfo, approvedBy: e.target.value })} placeholder="Name" /></div>
          <div className="form-group"><label>Position</label><input type="text" value={documentInfo.approvedByPosition} onChange={(e) => setDocumentInfo({ ...documentInfo, approvedByPosition: e.target.value })} placeholder="Position/Title" /></div>
          <div className="form-group"><label>Noted By (Optional)</label><input type="text" value={documentInfo.notedBy} onChange={(e) => setDocumentInfo({ ...documentInfo, notedBy: e.target.value })} placeholder="Name (Optional)" /></div>
          <div className="form-group"><label>Position</label><input type="text" value={documentInfo.notedByPosition} onChange={(e) => setDocumentInfo({ ...documentInfo, notedByPosition: e.target.value })} placeholder="Position/Title" /></div>
        </div>
      </ContentCard>

      <ContentCard title="Signature Block Preview" height="auto">
        <div className="sign-preview">
          {[
            { l: 'Prepared By', n: documentInfo.preparedBy, p: documentInfo.preparedByPosition },
            { l: 'Reviewed By', n: documentInfo.reviewedBy, p: documentInfo.reviewedByPosition },
            { l: 'Approved By', n: documentInfo.approvedBy, p: documentInfo.approvedByPosition },
          ].map((s, i) => (
            <div className="sign-preview__col" key={i}>
              <div className="sign-preview__label">{s.l}:</div>
              <div className="sign-preview__line">{s.n || ''}</div>
              <div className="sign-preview__pos">{s.p || ''}</div>
            </div>
          ))}
        </div>
        {documentInfo.notedBy && (
          <div className="sign-preview sign-preview--noted">
            <div className="sign-preview__col">
              <div className="sign-preview__label">Noted By:</div>
              <div className="sign-preview__line">{documentInfo.notedBy}</div>
              <div className="sign-preview__pos">{documentInfo.notedByPosition || ''}</div>
            </div>
          </div>
        )}
      </ContentCard>
    </>
  );

  const renderReview = () => (
    <>
      <ContentCard title="Export" height="auto">
        <p style={{ margin: '0 0 16px', color: 'var(--bq-text-muted)', fontSize: '13px' }}>
          Generate the final Bill of Quantities. The Excel workbook includes live formulas across Cover, Summary and Detailed sheets; the PDF mirrors the preview below.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={handleExportExcel}><Download size={16} /> Export to Excel</button>
          <button type="button" className="btn btn-secondary" onClick={handleExportPDF}><FileText size={16} /> Export to PDF</button>
        </div>
      </ContentCard>

      <ContentCard title="Live Document Preview" height="auto">
        <p style={{ margin: '0 0 14px', color: 'var(--bq-text-muted)', fontSize: '13px' }}>
          This mirrors the exported document and updates automatically as you edit.
        </p>
        <div className="boq-paper-frame">
          <div className="boq-paper">
            <div className="boq-paper__accent" />
            {companyLogo && (
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <img src={companyLogo} alt="Logo" style={{ maxHeight: '64px', maxWidth: '180px', objectFit: 'contain' }} />
              </div>
            )}
            {projectInfo.agencyName && (<div className="boq-paper__agency">{projectInfo.agencyName}</div>)}
            {projectInfo.agencyTagline && (<div className="boq-paper__tagline">{projectInfo.agencyTagline}</div>)}
            <h1 className="boq-paper__title">BILL OF QUANTITIES</h1>
            <div className="boq-paper__project">{projectInfo.projectName || 'Project Name'}</div>
            <div className="boq-paper__meta">
              {(projectInfo.boqNumber || '—')}{projectInfo.projectLocation ? `  •  ${projectInfo.projectLocation}` : ''}
            </div>

            <table className="boq-paper__table">
              <thead>
                <tr>
                  <th style={{ width: '11%' }}>Item</th>
                  <th>Description</th>
                  <th style={{ width: '9%' }}>Unit</th>
                  <th style={{ width: '11%', textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ width: '11%', textAlign: 'right' }}>Weight %</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {boqItems.length === 0 && (
                  <tr><td colSpan={7} className="boq-paper__empty">Add categories and items to see them appear here.</td></tr>
                )}
                {categories.map((cat) => {
                  const items = getCategoryItems(cat.id);
                  if (items.length === 0) return null;
                  return (
                    <React.Fragment key={cat.id}>
                      <tr className="boq-paper__band"><td colSpan={7}>{cat.code} — {cat.id}: {cat.name}</td></tr>
                      {items.map((item, index) => (
                        <tr key={item.id}>
                          <td style={{ textAlign: 'center' }}>{generateItemNumber(cat.id, index)}</td>
                          <td>{item.item}</td>
                          <td style={{ textAlign: 'center' }}>{item.unit}</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(Number(item.quantity) || 0)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(Number(item.unitCost) || 0)}</td>
                          <td style={{ textAlign: 'right' }}>{calculateWeight(Number(item.total) || 0)}%</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(Number(item.total) || 0)}</td>
                        </tr>
                      ))}
                      <tr className="boq-paper__subtotal">
                        <td colSpan={5} style={{ textAlign: 'right' }}>Category Subtotal</td>
                        <td style={{ textAlign: 'right' }}>{calculateWeight(calculateCategoryTotal(cat.id))}%</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(calculateCategoryTotal(cat.id))}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="boq-paper__total">
                  <td colSpan={5} style={{ textAlign: 'right' }}>SUBTOTAL</td>
                  <td style={{ textAlign: 'right' }}>{boqItems.length ? '100.00' : '0.00'}%</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(calculateSubtotal())}</td>
                </tr>
                {contingency > 0 && (<tr className="boq-paper__addon"><td colSpan={6} style={{ textAlign: 'right' }}>Contingency ({contingency}%)</td><td style={{ textAlign: 'right' }}>{formatCurrency(calculateContingency())}</td></tr>)}
                {profitMargin > 0 && (<tr className="boq-paper__addon"><td colSpan={6} style={{ textAlign: 'right' }}>Profit Margin ({profitMargin}%)</td><td style={{ textAlign: 'right' }}>{formatCurrency(calculateProfitMargin())}</td></tr>)}
                {overhead > 0 && (<tr className="boq-paper__addon"><td colSpan={6} style={{ textAlign: 'right' }}>Overhead ({overhead}%)</td><td style={{ textAlign: 'right' }}>{formatCurrency(calculateOverhead())}</td></tr>)}
                {escalation > 0 && (<tr className="boq-paper__addon"><td colSpan={6} style={{ textAlign: 'right' }}>Escalation ({escalation}%)</td><td style={{ textAlign: 'right' }}>{formatCurrency(calculateEscalation())}</td></tr>)}
                {miscellaneous > 0 && (<tr className="boq-paper__addon"><td colSpan={6} style={{ textAlign: 'right' }}>Miscellaneous ({miscellaneous}%)</td><td style={{ textAlign: 'right' }}>{formatCurrency(calculateMiscellaneous())}</td></tr>)}
                {calculateAdditionalCosts().filter((i) => i.amount > 0).map((i, idx) => (
                  <tr key={`ac-${idx}`} className="boq-paper__addon"><td colSpan={6} style={{ textAlign: 'right' }}>{i.name} ({i.percentage}%)</td><td style={{ textAlign: 'right' }}>{formatCurrency(i.amount)}</td></tr>
                ))}
                {vat > 0 && (<tr className="boq-paper__addon"><td colSpan={6} style={{ textAlign: 'right' }}>VAT ({vat}%)</td><td style={{ textAlign: 'right' }}>{formatCurrency(calculateVAT())}</td></tr>)}
                <tr className="boq-paper__grand">
                  <td colSpan={6} style={{ textAlign: 'right' }}>PROJECT TOTAL</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(calculateProjectTotal())}</td>
                </tr>
              </tfoot>
            </table>

            {(documentInfo.preparedBy || documentInfo.reviewedBy || documentInfo.approvedBy) && (
              <div className="boq-paper__signs">
                {[
                  { l: 'Prepared by', n: documentInfo.preparedBy, p: documentInfo.preparedByPosition },
                  { l: 'Reviewed by', n: documentInfo.reviewedBy, p: documentInfo.reviewedByPosition },
                  { l: 'Approved by', n: documentInfo.approvedBy, p: documentInfo.approvedByPosition },
                ].map((s, i) => (
                  <div key={i} className="boq-paper__sign">
                    <div className="boq-paper__sign-label">{s.l}:</div>
                    <div className="boq-paper__sign-line">{s.n || ''}</div>
                    <div className="boq-paper__sign-pos">{s.p || ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ContentCard>
    </>
  );

  const sectionContent = {
    overview: renderOverview,
    setup: renderSetup,
    categories: renderCategories,
    items: renderItems,
    costs: renderCosts,
    signoff: renderSignoff,
    review: renderReview,
  };

  return (
    <div className={`app-shell${navOpen ? ' nav-open' : ''}`}>
      <Sidebar
        sections={SECTIONS}
        active={activeSection}
        onSelect={(id) => { setActiveSection(id); setNavOpen(false); }}
        open={navOpen}
        onOpenBranding={() => { setBrandingOpen(true); setNavOpen(false); }}
        onOpenAccount={() => { setAccountOpen(true); setNavOpen(false); }}
      />
      <div className="nav-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />

      <div className="workspace">
        <AppHeader
          title={savedWorkName}
          placeholder="Untitled BOQ"
          onTitleChange={handleNameChange}
          badge={projectInfo.boqNumber}
          status={status}
          onToggleNav={() => setNavOpen((v) => !v)}
          onSave={handleBoqSave}
          onSaveNew={handleBoqSaveAsNew}
          onNew={startNew}
          onOpen={() => setOpenDialog(true)}
          savedCount={savedList.length}
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPDF}
        />

        <main className="section">
          <div className="section__head">
            <div className="section__heading">
              <h1 className="section__title">{activeMeta.label}</h1>
              <p className="section__desc">{activeMeta.desc}</p>
            </div>
            <div className="section__stepper">
              {prevSection && (
                <button type="button" className="btn btn-secondary" onClick={() => setActiveSection(prevSection.id)}>
                  ← {prevSection.label}
                </button>
              )}
              {nextSection && (
                <button type="button" className="btn btn-primary" onClick={() => setActiveSection(nextSection.id)}>
                  {nextSection.label} →
                </button>
              )}
            </div>
          </div>

          <div className="section__body">
            {(sectionContent[activeSection] || renderOverview)()}
          </div>
        </main>

        <TotalsBar items={totalsItems} />
      </div>

      <OpenDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        savedList={savedList}
        onOpen={(id) => { requestLoad(id); setOpenDialog(false); }}
        onDelete={deleteWork}
      />
      <BrandingDialog open={brandingOpen} onClose={() => setBrandingOpen(false)} />

      <AuthDialog
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        getSnapshot={buildSnapshot}
        onLoad={applySnapshot}
        currentName={savedWorkName}
        currentNumber={projectInfo.boqNumber}
      />
    </div>
  );
}

export default BOQ;
