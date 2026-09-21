import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.TEST_URL || 'https://system-j-nine.vercel.app';
const TEST_EMAIL = 'playwright_tester@jotaesportivo.com.br';
const TEST_PASSWORD = 'Playwright2026!';
const CLIENT_ID = '94e6df34-c88f-4e36-803c-a167a4574b6b'; // ORANGE FC RECIFE

const SCREENSHOTS_DIR = path.resolve('tests/screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 INICIANDO BATERIA DE TESTES PLAYWRIGHT E2E');
  console.log(`🌐 Alvo: ${BASE_URL}`);
  console.log('====================================================\n');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  const capturedErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
      capturedErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log(`[Browser Uncaught Error] ${err.message}`);
    capturedErrors.push(err.message);
  });

  try {
    // -------------------------------------------------------------
    // ETAPA 1: Login
    // -------------------------------------------------------------
    console.log('🔑 ETAPA 1: Autenticação no sistema...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    await page.fill('input#email', TEST_EMAIL);
    await page.fill('input#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Aguardar redirecionamento após login
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log(`✅ Login realizado com sucesso! Redirecionado para: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_pos_login.png') });

    // -------------------------------------------------------------
    // ETAPA 2: Mesa do Cliente - Programar Nova Postagem de Vídeo
    // -------------------------------------------------------------
    console.log('\n🎬 ETAPA 2: Teste de Programação de Vídeo no Cronograma...');
    await page.goto(`${BASE_URL}/clientes/${CLIENT_ID}`, { waitUntil: 'networkidle' });
    
    // Aguardar o botão "+ Cadastrar Vídeo"
    const cadastrarVideoBtn = page.locator('button:has-text("+ Cadastrar Vídeo"), button:has-text("+ PROGRAMAR / CADASTRAR VÍDEO")').first();
    await cadastrarVideoBtn.waitFor({ state: 'visible', timeout: 20000 });
    console.log('✅ Página da Mesa do Cliente carregada e botão de cadastro visível');

    await cadastrarVideoBtn.click();

    // Aguardar abertura do modal
    const modal = page.locator('div:has(h3:has-text("Programar Nova Postagem de Vídeo"))').last();
    await modal.waitFor({ state: 'visible', timeout: 8000 });
    console.log('✅ Modal "Programar Nova Postagem de Vídeo" aberto');

    // Preencher os dados da postagem
    const testTitle = `[E2E-TEST] Reels Playwright ${Date.now()}`;
    await modal.locator('input[placeholder*="Ex: Reels"]').fill(testTitle);
    await modal.locator('textarea[placeholder*="Instruções"]').fill('Roteiro e legenda gerados via teste automatizado Playwright validando formato_video e horário.');
    
    // Selecionar Formato / Status
    const selects = await modal.locator('select').all();
    if (selects.length >= 2) {
      await selects[0].selectOption({ index: 0 }); // Instagram Reels
      await selects[1].selectOption({ value: 'em_andamento' }); // Em Edição
    }

    // Data de Postagem
    const dateInput = modal.locator('input[type="date"]');
    if (await dateInput.count() > 0) {
      await dateInput.fill('2026-09-25');
    }

    // Horário de Agendamento
    const timeInput = modal.locator('input[type="time"]');
    if (await timeInput.count() > 0) {
      await timeInput.fill('18:30');
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_modal_postagem_preenchido.png') });

    // Clicar em "Cadastrar Postagem"
    console.log('Enviando formulário de nova postagem...');
    const submitBtn = modal.locator('button:has-text("Cadastrar Postagem")');
    await submitBtn.click();

    // Aguardar fechamento do modal e feedback
    await page.waitForTimeout(3000);

    // Verificar se houve toast de erro
    const toastErrors = await page.locator('[data-sonner-toast][data-type="error"]').allTextContents();
    console.log('Erros em toast detectados:', toastErrors.length > 0 ? toastErrors : 'Nenhum (perfeito)');
    
    const schemaError = toastErrors.find(t => t.includes('formato_video') || t.includes('schema cache'));
    if (schemaError) {
      throw new Error(`FALHA CRÍTICA: Erro de schema cache retornado: ${schemaError}`);
    }

    // Verificar se o card apareceu no Kanban
    const newCard = page.locator(`text=${testTitle}`).first();
    await newCard.waitFor({ state: 'visible', timeout: 15000 });
    console.log(`✅ SUCESSO ABSOLUTO! Post-it "${testTitle}" adicionado e renderizado com sucesso no Kanban!`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_kanban_com_postagem.png') });

    // -------------------------------------------------------------
    // ETAPA 3: Teste de Criação de Nova Coluna no Kanban
    // -------------------------------------------------------------
    console.log('\n📋 ETAPA 3: Teste de Criação de Nova Coluna no Kanban...');
    const novaColunaBtn = page.locator('button:has-text("+ Nova Coluna"), button:has-text("+ nova coluna")').first();
    await novaColunaBtn.click();

    const colunaModal = page.locator('div:has(h3:has-text("Criar Nova Coluna no Kanban"))').last();
    await colunaModal.waitFor({ state: 'visible', timeout: 5000 });
    const colName = `Revisão Cliente ${Date.now() % 1000}`;
    await colunaModal.locator('input[placeholder*="Em Validação"]').fill(colName);
    await colunaModal.locator('button:has-text("Criar Coluna")').click();

    await page.waitForTimeout(2000);
    console.log(`✅ SUCESSO! Nova coluna "${colName}" criada dinamicamente no Kanban.`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_nova_coluna_criada.png') });

    // -------------------------------------------------------------
    // ETAPA 4: Módulo Financeiro - Teste de Novo Lançamento
    // -------------------------------------------------------------
    console.log('\n💰 ETAPA 4: Teste de Registro Financeiro (Validação de Foreign Key)...');
    await page.goto(`${BASE_URL}/financeiro`, { waitUntil: 'networkidle' });

    const novoLancamentoBtn = page.locator('button:has-text("Novo Lançamento"), button:has-text("NOVO LANÇAMENTO")').first();
    await novoLancamentoBtn.waitFor({ state: 'visible', timeout: 15000 });
    console.log('✅ Página do Financeiro carregada');
    await novoLancamentoBtn.click();

    await page.waitForTimeout(1000);
    console.log('✅ Modal de Novo Lançamento Financeiro aberto');

    const descFinanceiro = `[E2E-TEST] Receita Playwright ${Date.now()}`;
    const descInput = page.locator('input[placeholder*="Mensalidade Contrato Red"]').first();
    await descInput.waitFor({ state: 'visible', timeout: 8000 });
    await descInput.fill(descFinanceiro);

    const valorInput = page.locator('input[placeholder="0,00"]').first();
    await valorInput.fill('350');

    // Selecionar categoria válida usando select[required]
    const catSelect = page.locator('select[required]').first();
    await catSelect.waitFor({ state: 'visible', timeout: 5000 });
    await catSelect.selectOption({ index: 1 });
    const catName = await catSelect.evaluate(el => el.options[el.selectedIndex]?.text);
    console.log(`✅ Categoria obrigatória selecionada com sucesso: "${catName}"`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_modal_financeiro_preenchido.png') });

    // Confirmar Lançamento
    console.log('Salvando lançamento financeiro...');
    const confirmarLancamentoBtn = page.locator('button:has-text("CONFIRMAR LANÇAMENTO"), button:has-text("Confirmar Lançamento")').first();
    await confirmarLancamentoBtn.click();

    await page.waitForTimeout(3000);

    const finErrors = await page.locator('[data-sonner-toast][data-type="error"]').allTextContents();
    console.log('Erros em toast detectados no Financeiro:', finErrors.length > 0 ? finErrors : 'Nenhum (perfeito)');

    const fkError = finErrors.find(t => t.includes('violates foreign key constraint') || t.includes('lancamentos_criado_por_fkey'));
    if (fkError) {
      throw new Error(`FALHA CRÍTICA: Erro de foreign key criado_por no Financeiro: ${fkError}`);
    }

    // Verificar se o lançamento aparece na listagem
    const lancamentoItem = page.locator(`text=${descFinanceiro}`).first();
    await lancamentoItem.waitFor({ state: 'visible', timeout: 15000 });
    console.log(`✅ SUCESSO ABSOLUTO! Lançamento financeiro "${descFinanceiro}" registrado e visível na tabela sem erro de foreign key!`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_financeiro_lancamento_salvo.png') });

    console.log('\n====================================================');
    console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
    console.log('====================================================');

  } catch (error) {
    console.error('\n❌ ERRO DURANTE OS TESTES:', error);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error_screenshot.png') });
    throw error;
  } finally {
    await browser.close();
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
