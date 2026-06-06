<?php
/**
 * نظام فلترة الكلمات المسيئة
 */

function normalizeText($text) {
    // Convert to lowercase
    $text = mb_strtolower($text, 'UTF-8');
    
    // Remove symbols, punctuation, and spaces
    // Only keep Arabic letters, English letters, and numbers
    $text = preg_replace('/[^\p{Arabic}A-Za-z0-9]/u', '', $text);
    
    // Normalize Arabic letters
    $normalize_map = [
        'أ' => 'ا', 'إ' => 'ا', 'آ' => 'ا', 'ٱ' => 'ا',
        'ة' => 'ه', 'ت' => 'ه', // sometimes people write ة as ت or ه
        'ي' => 'ى', 'ئ' => 'ى',
        'ؤ' => 'و',
        'ً' => '', 'ٌ' => '', 'ٍ' => '', 'َ' => '', 'ُ' => '', 'ِ' => '', 'ّ' => '', 'ْ' => '' // Remove Tashkeel
    ];
    
    // Replace letters
    foreach ($normalize_map as $search => $replace) {
        $text = str_replace($search, $replace, $text);
    }
    
    // Reduce repeated characters to a single character (e.g., احححححا -> احا)
    $text = preg_replace('/(.)\1+/u', '$1', $text);
    
    return $text;
}

function containsBadWords($comment) {
    if (empty(trim($comment))) {
        return false;
    }
    
    $normalized_comment = normalizeText($comment);
    
    // القاموس - شامل عربي، انجليزي، فرانكو
    $badwords = [
        // Arabic Bad Words
        'احا', 'احه', 'احي',
        'عرص', 'معرص', 'تعريص',
        'كسم', 'كسام',
        'شرموط', 'شرموطه', 'شرميط',
        'متناك', 'متناكه',
        'خول', 'خولات', 'مخولن',
        'منيوك', 'منيوكه',
        'قحبه', 'قحاب',
        'لبوه',
        'علق', 'علوق',
        'زب', 'زبي', 'زبر', 'زبري',
        'بضان', 'بضاني',
        'ابن الكلب', 'بنت الكلب',
        'وسخ', 'وسخه', 'اوساخ',
        'طيز', 'طيزي', 'مؤخره', // While مؤخره might be literal, usually context is bad, but let's keep it strict
        'عاهر', 'عاهره',
        'زانيه', 'زاني',
        'منيك', 'منيكه',
        'مومس',
        'خول',
        'نيك', 'نيكو', 'انيكك','زبي', 'زب', 'زبر', 'زبي', 'زبر', 'زبري',
         'كس', 'كسك', 'كسام', 'كسوك',
        
        // Franco / English-Arabic
        'a7a', 'a7aa', 'a7aaa',
        'a7e',
        'kosom', 'kosmk', 'ksmk', 'ksom', 'kusom',
        'sharmouta', 'sharmota', 'shrmota',
        'mtnaka', 'mtnak', 'metnaka', 'metnak',
        '5wl', 'khawal', 'khawl',
        'mnyak', 'mnyaka', 'menyak',
        'zeby', 'zeby', 'zobr',
        'bdaan', 'bdan',
        '3ars', '3rs', 'm3ars', 'm3rs',
        '5ara', 'khara','kos', 'ks', 'ksk', 'ksam', 'ksok',
        
        // English Bad Words
        'fuck', 'fuk', 'fck', 'fucker', 'fucking',
        'shit', 'bullshit',
        'bitch', 'bitches',
        'asshole', 'ass', 'asses',
        'dick', 'cock', 'pussy', 'vagina', 'penis',
        'slut', 'whore', 'hooker',
        'cunt',
        'motherfucker', 'mf',
        'bastard',
        'nigger', 'nigga',
        'faggot', 'fag',
        'retard'
    ];
    
    foreach ($badwords as $word) {
        $normalized_word = normalizeText($word);
        
        // We use strpos to check if the bad word exists anywhere in the normalized text
        if (strpos($normalized_comment, $normalized_word) !== false) {
            return true;
        }
    }
    
    return false;
}
?>
