# Generated for ME V1.1 — Intelligent Link Memories
# Adds memory_type, url, domain fields to the Memory model.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("memories", "0003_remove_memory_idx_memory_user_status_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="memory",
            name="memory_type",
            field=models.CharField(
                choices=[("text", "Text"), ("link", "Link")],
                db_index=True,
                default="text",
                help_text="The classified content type of this memory.",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="memory",
            name="url",
            field=models.URLField(
                blank=True,
                null=True,
                help_text="The normalized URL for LINK memories.",
            ),
        ),
        migrations.AddField(
            model_name="memory",
            name="domain",
            field=models.CharField(
                blank=True,
                default="",
                help_text="The extracted domain for LINK memories (e.g. github.com).",
                max_length=255,
            ),
            preserve_default=False,
        ),
        migrations.AddIndex(
            model_name="memory",
            index=models.Index(
                fields=["user", "memory_type"],
                name="idx_memory_user_type",
            ),
        ),
    ]
