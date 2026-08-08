import os
from PIL import Image, ImageDraw
import numpy as np

def generate_icons():
    src_path = 'static/icons/icon-512.png'
    if not os.path.exists(src_path):
        print(f"Error: {src_path} does not exist.")
        return False

    # Load 512x512 ME logo source
    src_img = Image.open(src_path).convert('RGBA')
    src_arr = np.array(src_img)

    # Key out dark background (RGB <= 30) for foreground RGBA transparent icon
    bg_mask = (src_arr[:, :, 0] <= 30) & (src_arr[:, :, 1] <= 30) & (src_arr[:, :, 2] <= 30)
    fg_arr = src_arr.copy()
    fg_arr[bg_mask, 3] = 0
    fg_trans = Image.fromarray(fg_arr)

    # Background color #0A0A0A (matches res/values/ic_launcher_background.xml)
    bg_color = (10, 10, 10, 255)

    # Densities and sizes: (folder_name, legacy_size, adaptive_size)
    specs = [
        ('mipmap-mdpi', 48, 108),
        ('mipmap-hdpi', 72, 162),
        ('mipmap-xhdpi', 96, 216),
        ('mipmap-xxhdpi', 144, 324),
        ('mipmap-xxxhdpi', 192, 432),
    ]

    base_res_dir = 'mobile/android/app/src/main/res'

    for folder, legacy_size, adaptive_size in specs:
        folder_path = os.path.join(base_res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)

        # 1. ic_launcher_foreground.png (adaptive foreground)
        fg_resized = fg_trans.resize((adaptive_size, adaptive_size), Image.Resampling.LANCZOS)
        fg_path = os.path.join(folder_path, 'ic_launcher_foreground.png')
        fg_resized.save(fg_path, 'PNG')

        # 2. ic_launcher.png (legacy square)
        # Composite background color #0A0A0A + foreground
        bg_canvas = Image.new('RGBA', (legacy_size, legacy_size), bg_color)
        fg_legacy = fg_trans.resize((legacy_size, legacy_size), Image.Resampling.LANCZOS)
        legacy_sq = Image.alpha_composite(bg_canvas, fg_legacy)
        sq_path = os.path.join(folder_path, 'ic_launcher.png')
        legacy_sq.save(sq_path, 'PNG')

        # 3. ic_launcher_round.png (legacy round)
        # Create circular mask at 4x resolution for anti-aliasing
        supersample = 4
        mask_size = legacy_size * supersample
        mask = Image.new('L', (mask_size, mask_size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, mask_size - 1, mask_size - 1), fill=255)
        mask_resized = mask.resize((legacy_size, legacy_size), Image.Resampling.LANCZOS)

        round_canvas = legacy_sq.copy()
        round_canvas.putalpha(mask_resized)
        round_path = os.path.join(folder_path, 'ic_launcher_round.png')
        round_canvas.save(round_path, 'PNG')

        print(f"Generated {folder}: ic_launcher.png ({legacy_size}x{legacy_size}), ic_launcher_foreground.png ({adaptive_size}x{adaptive_size}), ic_launcher_round.png ({legacy_size}x{legacy_size})")

    return True

if __name__ == '__main__':
    generate_icons()
